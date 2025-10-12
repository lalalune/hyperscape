// Stub for stats-gl panel
export default class Panel {
  dom: HTMLElement;
  
  constructor(name: string, color: string, bgColor?: string) {
    this.dom = document.createElement('div');
  }
  
  update(value: number, maxValue: number, max?: number, maxGraph?: number, decimals?: number) {}
}