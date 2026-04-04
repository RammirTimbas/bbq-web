import os from "node:os";

function isPrivateIpv4(address) {
  return address.startsWith("10.")
    || address.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);
}

export function getLocalIpAddress() {
  const override = String(process.env.LOCAL_IP_OVERRIDE ?? "").trim();

  if (override) {
    return override;
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        candidates.push(entry.address);
      }
    }
  }

  const preferred = candidates.find(isPrivateIpv4);

  if (preferred) {
    return preferred;
  }

  if (candidates[0]) {
    return candidates[0];
  }

  return "127.0.0.1";
}
