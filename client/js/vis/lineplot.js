/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */

class LinePlot extends VComponent {

    // Super class methods ----------------

    static get events() {
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
            {name: 'axis', pos: {x: 60, y: 0}},
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
        this._initAxisAndSlider();

    }

    _initAxisAndSlider() {
        const yScale = this.yScale.copy();
        yScale.clamp(true);

        const axisParent = this.layers.axis;

        axisParent.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

        // Add a zero line:
        this.layers.main.append('line').attr('class', 'zeroLine');

        // Add the slider:
        const dragging = () =>
          this.eventHandler.trigger(
            this.events.thresholdChanged, {newValue: yScale.invert(d3.event.y)});

        axisParent.append('line').attrs({
            class: 'slider-bg',
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).styles({'stroke-width': '10', 'stroke': 'black', 'opacity': '0'})
          .call(d3.drag().on('start drag', dragging));

        axisParent.append('circle').attrs({
            class: 'slider-handle non-active',
            cy: yScale(this.thresholdValue),
            r: 5
        });

        this.layers.overlay.append('line').attr('class', 'thresholdLine');

    }


    _wrangle(data) {
        const dataLength = data.timeSteps;
        this.xScale = d3.scaleLinear().domain([0, dataLength])
          .range([0, dataLength * this.options.cellWidth]);

        // Determine if update axis is necessary:
        const st = this._states;
        st.needsAxisUpdate = (st.dataLength === null || st.dataLength != dataLength);
        st.dataLength = dataLength;

        return data;
    }


    _render(renderData) {
        const st = this._states;

        this._updateLines(renderData);

        // Only update axis if necessary:
        if (st.needsAxisUpdate) {
            this._updateAxisAndSlider();
            st.needsAxisUpdate = false;
        }

    }

    _updateAxisAndSlider() {
        const yScale = this.yScale;
        const xScale = this.xScale;
        const clampedYScale = yScale.copy().clamp(true);

        const axisParent = this.layers.axis;
        axisParent.select('.y-axis').call(d3.axisLeft(yScale));

        // Update zero line
        this.layers.main.select('.zeroLine')
          .attrs({
              x1: xScale.range()[0],
              x2: xScale.range()[1],
              y1: yScale(0),
              y2: yScale(0)
          });

        // Update the slider area
        const dragging = () =>
          this.eventHandler.trigger(
            LinePlot.events.thresholdChanged, {newValue: clampedYScale.invert(d3.event.y)});

        axisParent.select('.slider-bg').attrs({
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).call(d3.drag().on('start drag', dragging));

        // Update threshold handle and threshold line
        const tValue = yScale(this.thresholdValue);
        axisParent.select('.slider-handle').attrs({
            cy: tValue,
        });

        this.layers.overlay.select('.thresholdLine')
          .attrs({
              x1: xScale.range()[0],
              x2: xScale.range()[1],
              y1: tValue,
              y2: tValue
          });
    }

    _updateLines(renderData) {
        const xScale = this.xScale;
        const yScale = this.yScale;


        const lineOpacity = 1.0 / (Math.sqrt(renderData.cellValues.length) + 0.00001);
        const lineGenerator = d3.line()
          .x((d, i) => xScale(i))
          .y(d => yScale(d));

        this._updateLineSubset({
            container: this.layers.main,
            data: renderData.cellValues.filter(d => !_.includes(renderData.selectedCells, d.index)),
            lineGenerator, lineOpacity
        })


        this._updateLineSubset({
            container: this.layers.overlay,
            data: renderData.cellValues.filter(d => _.includes(renderData.selectedCells, d.index)),
            lineOpacity: null,
            lineGenerator
        })


    }

    _updateLineSubset({container, data, lineGenerator, lineOpacity}) {
        const valueLines = container.selectAll('.valueLine')
          .data(data);
        valueLines.exit().remove();

        valueLines
          .enter().append('path')
          .merge(valueLines)
          .attrs({
              "class": d => "valueLine id_" + d.index,
              d: d => lineGenerator(d.values)
          })
          .styles({
              opacity: lineOpacity
          });

    }


    // Lineplot methods ----------------

    get yScale() {
        const op = this.options;

        return op.yScale ||
          d3.scaleLinear().domain([op.minValue, op.maxValue]).range([op.height, 0]);
    }

    actionUpdateThreshold(newValue) {
        this.thresholdValue = newValue;
        this._updateAxisAndSlider();

    }

    _bindLocalEvents(eventHandler) {
        eventHandler.bind(LinePlot.events.thresholdChanged,
          ({newValue}) => this.actionUpdateThreshold(newValue))
    }
}

LinePlot;
