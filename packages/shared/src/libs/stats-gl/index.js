// Stub for stats-gl
// This appears to be a missing dependency
export default class StatsGL {
    dom;
    constructor(options) {
        this.dom = document.createElement('div');
    }
    init(renderer, addToDOM) { }
    addPanel(panel, position) { }
    begin() { }
    end() { }
    update() { }
}
