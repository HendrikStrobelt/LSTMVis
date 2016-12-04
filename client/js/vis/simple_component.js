/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */

/* global VComponent, d3, svg_translate */

class SimpleComponent extends VComponent { // eslint-disable-line no-unused-vars

    static get events() {
        return {
            textClick: 'SimpleVis_textclick'
        }
    }

    _getDefaultOptions() { // eslint-disable-line class-methods-use-this
        return {
            x: 30,
            y: 50
        }
    }

    _init() {
        this.mainG = d3.select(this.parent).append('g')
          .attr('transform', svg_translate({x: this.options.x, y: this.options.y}));

        this.mainG.append('text').text('SimpleVis').on('click', () => console.warn(SimpleComponent.events.textClick));
    }

}
