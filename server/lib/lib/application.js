/**
 * An application definition from Hilbert Cfg
 */
class Application {
  constructor(id, cfg) {
    this.id = id;
    this.name = cfg.name || id;
    this.description = cfg.description || '';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
    };
  }
}

module.exports = Application;
