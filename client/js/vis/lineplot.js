/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */

class LinePlotComponent extends VComponent {

    get events() {
        return {
            thresholdChanged: 'lineplot-thresholdChanged'
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 0, y: 50},
            // A y scale that also defines the height or 'null' to use auto scale
            yScale: null,
            // Default parameter for linear auto scale
            minValue: -1,
            maxValue: 1,
            height: 150,
            // Default threshold
            threshold: 0
        }
    }

    _init() {

        // Sub-component arrangement
        const layout = {
            thresholdSlider: {x: 60, y: 0, w: 10},
            pc: {x: 60, y: 0}
        };
        this.lp = SVG.group(this.parent, 'lineplot ID' + this.id, this.options.pos);
        this.lpMain = SVG.group(this.lp, 'main', layout.pc);
        this.lpOverlay = SVG.group(this.lp, 'overlay', layout.pc);

        this.lpSlider = SVG.group(this.lp, 'threshold-slider', layout.thresholdSlider);
        this._initThresholdSlider(this.lpSlider);
    }

    _wrangle(data) {
        return super._wrangle(data);
    }


    _render(renderData) {
        const op = this.options;
        const yScale = op.yScale || d3.scaleLinear([op.height, 0]).domain([op.minValue, op.maxValue]);
        this._updateThresholdSlider({yScale, threshold: op.threshold});
    }


    _thresholdDragged(parent, yScale) {
        const value = yScale.invert(d3.event.y);
        parent.select('.slider-handle').attr('cy', yScale(value));
        this.eventHandler.trigger(this.events.thresholdChanged, {value});

    }

    _initThresholdSlider(parent) {
        const threshold = 0;
        const op = this.options;
        const yScale = op.yScale || d3.scaleLinear().domain([op.minValue, op.maxValue]).range([op.height, 0]);
        yScale.clamp(true);

        parent.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

        parent.append('line').attrs({
            class: 'slider-bg',
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).styles({'stroke-width': '10', 'stroke': 'black', 'opacity': '0'})
          .call(d3.drag().on('start drag',
            () => this._thresholdDragged(parent, yScale)));

        parent.append('circle').attrs({
            class: 'slider-handle non-active',
            cy: yScale(threshold),
            r: 5
        })
    }

    _updateThresholdSlider({yScale, threshold}) {


    }


}

LinePlotComponent;
