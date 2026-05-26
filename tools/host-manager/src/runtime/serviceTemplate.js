const path = require("path");

class ServiceTemplate {
  constructor() {
    this.templates = new Map();
  }

  loadFromConfig(rawTemplates, baseDirectory) {
    if (!rawTemplates || typeof rawTemplates !== "object") {
      return;
    }

    for (const [name, def] of Object.entries(rawTemplates)) {
      if (!def || typeof def !== "object") continue;

      if (def.type === "built-in") {
        this.templates.set(name, {
          name,
          type: "built-in",
          port: def.port || 0,
          description: def.description || ""
        });
        continue;
      }

      if (!def.executable) {
        this.templates.set(name, {
          name,
          type: "dynamic",
          description: def.description || "",
          needsPort: def.needsPort === true
        });
        continue;
      }

      const cwd = def.cwd
        ? (path.isAbsolute(def.cwd) ? path.normalize(def.cwd) : path.resolve(baseDirectory, def.cwd))
        : baseDirectory;

      this.templates.set(name, {
        name,
        type: "process",
        executable: def.executable,
        args: Array.isArray(def.args) ? [...def.args] : [],
        cwd,
        env: { ...(def.env || {}) },
        description: def.description || "",
        portRange: def.portRange || null,
        maxRestarts: def.maxRestarts != null ? def.maxRestarts : 10,
        needsPort: def.needsPort === true
      });
    }
  }

  get(name) {
    return this.templates.get(name) || null;
  }

  has(name) {
    return this.templates.has(name);
  }

  list() {
    return Array.from(this.templates.values()).map(t => ({
      name: t.name,
      type: t.type,
      description: t.description,
      needsPort: t.needsPort === true
    }));
  }

  resolve(templateName, overrides = {}) {
    const template = this.get(templateName);
    if (!template) return null;
    if (template.type === "built-in") return { type: "built-in", template };

    const args = template.args.map(a => this._interpolate(a, overrides));
    const env = { ...template.env };
    for (const [key, value] of Object.entries(overrides.env || {})) {
      env[key] = String(value);
    }

    return {
      type: "process",
      executable: overrides.executable || template.executable,
      args,
      cwd: overrides.cwd || template.cwd,
      env,
      templateName: template.name,
      maxRestarts: overrides.maxRestarts != null ? overrides.maxRestarts : template.maxRestarts,
      needsPort: template.needsPort === true
    };
  }

  _interpolate(value, overrides) {
    if (typeof value !== "string") return value;
    return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (overrides[key] !== undefined) return String(overrides[key]);
      return match;
    });
  }
}

module.exports = ServiceTemplate;
