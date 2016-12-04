/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/3/16.
 */


class SimpleComponent extends VComponent {

    static get events() {
        return {
            textClick: 'SimpleVis_textclick'
        }
    }

    _getDefaultOptions() {
        return {
            x: 30,
            y: 50
        }
    }

    _init() {
        this.mainG = d3.select(this.parent).append('g')
          .attr('transform', SVG.translate({x: this.options.x, y: this.options.y}));

        this.mainG.append('text').text('SimpleVis').on('click', () => console.warn(SimpleComponent.events.textClick));
    }

}

SimpleComponent;
