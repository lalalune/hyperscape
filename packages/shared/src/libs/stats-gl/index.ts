// Stub for stats-gl
// This appears to be a missing dependency

export default class StatsGL {
  dom: HTMLElement;

  constructor(options?: {
    logsPerSecond?: number;
    samplesLog?: number;
    samplesGraph?: number;
    precision?: number;
    horizontal?: boolean;
    minimal?: boolean;
    mode?: number;
  }) {
    this.dom = document.createElement("div");
  }

  init(renderer: any, addToDOM?: boolean) {}
  addPanel(panel: any, position?: number) {}
  begin() {}
  end() {}
  update() {}
}
