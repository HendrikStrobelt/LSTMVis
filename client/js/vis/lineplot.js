/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */

class LinePlot extends VComponent {

    // Super class methods ----------------

    static get events() {
        return {
            thresholdChanged: 'lineplot-thresholdChanged',
            cellHovered: 'lineplot-cellhovered'
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
            LinePlot.events.thresholdChanged, {newValue: yScale.invert(d3.event.y)});

        axisParent.append('line').attrs({
            class: 'slider-bg',
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).styles({'stroke-width': '20', 'stroke': 'black', 'opacity': '0'})
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

        // Determine Min/Max values
        let minValue = Number.MAX_VALUE;
        let maxValue = -Number.MAX_VALUE;

        data.cellValues.forEach(cell => {
            cell.values.forEach(value => {
                if (minValue > value) minValue = value;
                if (maxValue < value) maxValue = value;
            })
        })

        if (minValue < 0) {
            const maxAbs = maxValue > -minValue ? maxValue : -minValue;
            this.options.minValue = -maxAbs;
            this.options.maxValue = maxAbs;
        } else {
            this.options.minValue = 0;
            this.options.maxValue = maxValue;
        }

        // Determine if update axis is necessary:
        const st = this._states;
        st.needsAxisUpdate = (st.dataLength === null || st.dataLength !== dataLength);
        st.dataLength = dataLength;

        return data;
    }


    _render(renderData) {

        const dataLength = renderData.timeSteps;
        this.xScale = d3.scaleLinear().domain([0, dataLength])
          .range([0, dataLength * this.options.cellWidth]);


        this._updateLines(renderData);
        this._updateAxisAndSlider();

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
        const dragging = () => {
            const v = clampedYScale.invert(d3.event.y);
            if (this._states.threshold !== v) {
                this._states.threshold = v;
                this.eventHandler.trigger(
                  LinePlot.events.thresholdChanged, {newValue: v});
            }


        }

        axisParent.select('.slider-bg').attrs({
            y1: yScale.range()[1],
            y2: yScale.range()[0]
        }).call(d3.drag().on('start drag', dragging));

        this._updateThreshold();
    }

    _updateThreshold() {
        const xScale = this.xScale;

        // Update threshold handle and threshold line
        const tValue = this.yScale(this.thresholdValue);
        this.layers.axis.select('.slider-handle').attrs({
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


        const highlightedCells = this._updateLineSubset({
            container: this.layers.overlay,
            data: renderData.cellValues.filter(d => _.includes(renderData.selectedCells, d.index)),
            lineOpacity: null,
            lineGenerator
        })

        const hover = active => d =>
          this.eventHandler.trigger(LinePlot.events.cellHovered,
            {index: active ? d.index : -1});

        highlightedCells
          .on('mouseover', hover(true))
          .on('mouseout', hover(false));


    }

    _updateLineSubset({container, data, lineGenerator, lineOpacity}) {
        const valueLines = container.selectAll('.valueLine').data(data);
        valueLines.exit().remove();

        return valueLines
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
        if (op.yScale) return op.yScale.range([op.height, 0]);

        return d3.scaleLinear().domain([op.minValue, op.maxValue])
          .range([op.height, 0]);
    }

    actionUpdateThreshold(newValue) {
        this.thresholdValue = newValue;
        this._updateThreshold();

    }

    actionUpdateSelectedCells(selCells) {
        this.renderData.selectedCells = selCells;
        this._render(this.renderData);
    }

    actionCellHovered(cell) {
        this.layers.overlay.selectAll('.valueLine')
          .classed('hovered', d => cell === d.index)
    }


    _bindLocalEvents(eventHandler) {
        this._bindEvent(eventHandler, LinePlot.events.thresholdChanged,
          ({newValue}) => this.actionUpdateThreshold(newValue))
    }


}

LinePlot;
