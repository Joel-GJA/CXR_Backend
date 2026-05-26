const fs = require("fs");
const path = require("path");

class LogRotator {
  constructor(logsDir, maxSizeBytes = 10 * 1024 * 1024, maxFiles = 5) {
    this.logsDir = logsDir;
    this.maxSizeBytes = maxSizeBytes;
    this.maxFiles = maxFiles;
    fs.mkdirSync(logsDir, { recursive: true });
  }

  append(serviceId, stream, data) {
    const logPath = this._logPath(serviceId, stream);
    try {
      const stat = fs.statSync(logPath);
      if (stat.size >= this.maxSizeBytes) {
        this._rotate(logPath);
      }
    } catch (e) {
    }
    try {
      fs.appendFileSync(logPath, data);
    } catch (e) {
    }
  }

  _rotate(logPath) {
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${logPath}.${i}`;
      const newPath = `${logPath}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        try {
          fs.renameSync(oldPath, newPath);
        } catch (e) {
        }
      }
    }
    try {
      fs.renameSync(logPath, `${logPath}.1`);
    } catch (e) {
    }
  }

  readTail(serviceId, stream, maxLines = 500) {
    const logPath = this._logPath(serviceId, stream);
    try {
      const stat = fs.statSync(logPath);
      if (stat.size === 0) return "";
      const fd = fs.openSync(logPath, "r");
      const readSize = Math.min(stat.size, 65536);
      const buffer = Buffer.alloc(readSize);
      const bytesRead = fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
      fs.closeSync(fd);
      const tail = buffer.toString("utf8", 0, bytesRead);
      const lines = tail.split(/\r?\n/);
      return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
    } catch (error) {
      return "";
    }
  }

  getLogPath(serviceId, stream) {
    return this._logPath(serviceId, stream);
  }

  _logPath(serviceId, stream) {
    const sanitized = serviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.logsDir, `${sanitized}.${stream}.log`);
  }
}

module.exports = LogRotator;
