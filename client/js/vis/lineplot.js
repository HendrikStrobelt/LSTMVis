/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */

class LinePlot extends VComponent {

    // Super class methods ----------------

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
            // Cell width along x axis
            cellWidth: 25
        }
    }

    get layout() {
        return [
            {name: 'main', pos: {x: 60, y: 0}},
            {name: 'overlay', pos: {x: 60, y: 0}},
            {name: 'thresholdSlider', pos: {x: 60, y: 0}},
        ]
    }

    get _dataFormat() {
        return {
            timeSteps: 3,
            cellValues: [{index: 0, values: [0.1, 0.3, 0.5]}, {index: 1, values: [0.4, 0.5, 0.6]}],
            selectedCells: [],
            deselectedCells: []
        }
    }

    _init() {

        this.thresholdValue = 0;
        this._initThresholdSlider();
        this._initThresholdLine();

    }

    _initThresholdSlider() {
        const yScale = this.yScale.copy();
        yScale.clamp(true);

        const sliderParent = this.layers.thresholdSlider;

        sliderParent.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

        const dragging = () =>
          this.eventHandler.trigger(
            this.events.thresholdChanged, {newValue: yScale.invert(d3.event.y)});

        sliderParent.append('line').attrs({
            class: 'slider-bg',
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).styles({'stroke-width': '10', 'stroke': 'black', 'opacity': '0'})
          .call(d3.drag().on('start drag', dragging));

        sliderParent.append('circle').attrs({
            class: 'slider-handle non-active',
            cy: yScale(this.thresholdValue),
            r: 5
        })


    }

    _initThresholdLine() {
        this.layers.overlay.append('line').attr('class', 'thresholdLine');
    }

    _wrangle(data) {
        const dataLength = data.timeSteps;
        this.xScale = d3.scaleLinear().domain([0, dataLength])
          .range([0, dataLength * this.options.cellWidth]);

        return data;
    }


    _render(renderData) {

        const xScale = this.xScale;
        const yScale = this.yScale;

        this._updateThresholdLine({xScale, yPos: yScale(this.thresholdValue)});

        this._updateLines({xScale, yScale, renderData});

    }


    // Lineplot methods ----------------

    get yScale() {
        const op = this.options;

        return op.yScale ||
          d3.scaleLinear().domain([op.minValue, op.maxValue]).range([op.height, 0]);
    }

    actionUpdateThreshold(newValue) {
        const xScale = this.xScale;
        const yScale = this.yScale;
        this.thresholdValue = newValue;
        this.layers.thresholdSlider.select('.slider-handle').attr('cy', yScale(newValue));
        this._updateThresholdLine({xScale, yPos: yScale(newValue)});
    }

    _bindLocalEvents(eventHandler) {
        eventHandler.bind(this.events.thresholdChanged,
          ({newValue}) => this.actionUpdateThreshold(newValue))
    }


    _updateThresholdLine({xScale, yPos}) {
        this.layers.overlay.select('.thresholdLine')
          .attrs({
              x1: xScale.range()[0],
              x2: xScale.range()[1],
              y1: yPos,
              y2: yPos
          });
    }


    _updateLines({xScale, yScale, renderData}) {
        // const line_opacity = 1. / (Math.sqrt(dt.draw_data.length) + .00001);
        // this.lpMain


    }
}

LinePlot;
