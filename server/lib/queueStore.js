import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function createId(prefix = "item") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function withVoteSet(item) {
  if (!item) {
    return null;
  }

  return {
    ...item,
    voters: item.voters instanceof Set ? item.voters : new Set(item.voters ?? []),
    votes: item.votes ?? 0
  };
}

export class QueueStore {
  constructor(options = {}) {
    this.queue = [];
    this.currentItem = null;
    this.users = new Map();
    this.isPlaying = false;
    this.currentPositionMs = 0;
    this.skipThresholdRatio = Number(options.skipThresholdRatio ?? 0.5);
    this.maxItemsPerUser = Number(options.maxItemsPerUser ?? 5);
    this.autoDeleteUploadedFiles = options.autoDeleteUploadedFiles !== false;
  }

  attachUser(socketId, user) {
    this.users.set(socketId, user);
  }

  detachUser(socketId) {
    this.users.delete(socketId);
  }

  getActiveUsers() {
    const uniqueUsers = new Map();

    for (const user of this.users.values()) {
      if (!uniqueUsers.has(user.sessionId)) {
        uniqueUsers.set(user.sessionId, user);
      }
    }

    return Array.from(uniqueUsers.values());
  }

  getActiveUserCount() {
    return this.getActiveUsers().length;
  }

  getQueueCountForUser(sessionId) {
    const queued = this.queue.filter((item) => item.addedBy.sessionId === sessionId).length;
    const current = this.currentItem?.addedBy.sessionId === sessionId ? 1 : 0;
    return queued + current;
  }

  canUserAdd(sessionId) {
    return this.getQueueCountForUser(sessionId) < this.maxItemsPerUser;
  }

  addItem(payload) {
    if (!this.canUserAdd(payload.addedBy.sessionId)) {
      throw new Error(`You can only queue up to ${this.maxItemsPerUser} items at a time.`);
    }

    const item = withVoteSet({
      ...payload,
      lyrics: payload.lyrics ?? "",
      id: createId(payload.type),
      votes: 0,
      voters: []
    });

    if (!this.currentItem) {
      this.currentItem = item;
      this.isPlaying = true;
      this.currentPositionMs = 0;
      return { item: this.serializeItem(item), startedPlaying: true };
    }

    this.queue.push(item);
    return { item: this.serializeItem(item), startedPlaying: false };
  }

  setPlaybackState(nextState) {
    this.isPlaying = Boolean(nextState);
  }

  setPlaybackPosition(positionMs) {
    this.currentPositionMs = Math.max(0, Number(positionMs) || 0);
  }

  setCurrentLyrics(lyrics) {
    if (!this.currentItem) {
      throw new Error("Nothing is currently playing.");
    }

    this.currentItem.lyrics = String(lyrics ?? "");
    return this.currentItem;
  }

  getSkipThreshold() {
    return Math.max(1, Math.ceil(this.getActiveUserCount() * this.skipThresholdRatio));
  }

  registerSkipVote(sessionId) {
    if (!this.currentItem) {
      throw new Error("Nothing is currently playing.");
    }

    if (this.currentItem.voters.has(sessionId)) {
      throw new Error("You have already voted to skip this item.");
    }

    this.currentItem.voters.add(sessionId);
    this.currentItem.votes = this.currentItem.voters.size;

    return {
      votes: this.currentItem.votes,
      threshold: this.getSkipThreshold(),
      shouldSkip: this.currentItem.votes >= this.getSkipThreshold()
    };
  }

  async shiftQueue() {
    const previous = this.currentItem;
    const nextItem = this.queue.shift() ?? null;

    this.currentItem = nextItem ? withVoteSet({ ...nextItem, votes: 0, voters: [] }) : null;
    this.isPlaying = Boolean(this.currentItem);
    this.currentPositionMs = 0;

    await this.deleteLocalFileIfNeeded(previous);
    return this.currentItem;
  }

  async markCurrentEnded() {
    return this.shiftQueue();
  }

  async skipCurrentItem() {
    return this.shiftQueue();
  }

  async removeQueuedItem(itemId) {
    const index = this.queue.findIndex((item) => item.id === itemId);

    if (index === -1) {
      throw new Error("Queue item not found.");
    }

    const [removed] = this.queue.splice(index, 1);
    await this.deleteLocalFileIfNeeded(removed);
    return removed;
  }

  async clearQueue() {
    const items = [...this.queue];
    this.queue = [];
    await Promise.all(items.map((item) => this.deleteLocalFileIfNeeded(item)));
  }

  async clearAll() {
    const current = this.currentItem;
    const queued = [...this.queue];

    this.currentItem = null;
    this.queue = [];
    this.isPlaying = false;
    this.currentPositionMs = 0;

    await Promise.all([
      this.deleteLocalFileIfNeeded(current),
      ...queued.map((item) => this.deleteLocalFileIfNeeded(item))
    ]);
  }

  async deleteLocalFileIfNeeded(item) {
    if (!item || item.type !== "local" || !this.autoDeleteUploadedFiles || !item.filePath) {
      return;
    }

    try {
      await fs.unlink(path.resolve(item.filePath));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to delete local media file:", error);
      }
    }
  }

  serializeItem(item) {
    if (!item) {
      return null;
    }

    return {
      id: item.id,
      title: item.title,
      type: item.type,
      source: item.source,
      thumbnail: item.thumbnail ?? null,
      mediaKind: item.mediaKind ?? null,
      mimeType: item.mimeType ?? null,
      artist: item.artist ?? "",
      lyrics: item.lyrics ?? "",
      syncedLyrics: item.syncedLyrics ?? [],
      addedBy: item.addedBy,
      votes: item.votes ?? 0
    };
  }

  getSnapshot() {
    const activeUsers = this.getActiveUsers();

    return {
      currentItem: this.serializeItem(this.currentItem),
      queue: this.queue.map((item) => this.serializeItem(item)),
      isPlaying: this.isPlaying,
      currentPositionMs: this.currentPositionMs,
      activeUsers: activeUsers.map((user) => ({
        sessionId: user.sessionId,
        nickname: user.nickname,
        role: user.role
      })),
      skipVotes: this.currentItem?.votes ?? 0,
      skipThreshold: this.getSkipThreshold(),
      maxItemsPerUser: this.maxItemsPerUser
    };
  }
}
