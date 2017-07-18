/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/9/17.
 */


class WordMatrix extends VComponent {

    static get events() {
        return {
            cellHovered: 'wordmatrix_cellhov'
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 0, y: 0},
            cellWidth: 35,
            cellPadding: 4,
            cellHeight: 18,
            rowHeight: 20
        }
    }

    get layout() {
        return [
            {name: 'measure', pos: {x: 0, y: -40}},
            {name: 'wmBackground', pos: {x: 0, y: 0}},
            {name: 'wmMatrix', pos: {x: 0, y: 0}},
            {name: 'overlay', pos: {x: 0, y: 0}}
        ]
    }

    _init() {
        const svgMeasure = new SVGMeasurements(this.layers.measure, 'word');
        this._calcTextLength = text => svgMeasure.textLength(text);

    }


    _wrangle(data) {
        return {
            wordMatrix: data.wordMatrix.map(
              (row, index) => {
                  const words = row.words.map(word => ({word, length: this._calcTextLength(word)}));

                  return {posOffset: row.posOffset || 0, rowId: row.rowId || index, words}
              }),
            heatmap: data.heatmap || data.wordMatrix.map(row => row.words.map(() => '#fff')),
            leftPadding: data.leftPadding || -1
        };
    }


    _render(renderData) {
        if (renderData) {
            const rowCount = renderData.wordMatrix.length;
            const colCount = renderData.wordMatrix[0].words.length;
            const lp = renderData.leftPadding;
            const cw = this.options.cellWidth;

            this.yScale = d3.scaleLinear()
              .domain([0, rowCount])
              .range([0, rowCount * this.options.rowHeight]);

            if (lp > -1) {
                this.xScale = d3.scaleLinear()
                  .domain([0, lp - 1, lp, colCount])
                  .range([0, (lp - 1) * cw, lp * cw + 5, colCount * cw + 5])
            } else {
                this.xScale = d3.scaleLinear()
                  .domain([0, colCount])
                  .range([0, colCount * cw])
            }


            this._renderWords(renderData.wordMatrix);
            this._renderHeatmap(renderData.wordMatrix, renderData.heatmap);
            this._renderPadding(lp);
        }
    }

    _renderWords(rowData) {
        const op = this.options;

        const wordTransform = (d, i) => {
            const scale = (op.cellWidth - op.cellPadding) / d.length || 1;
            const translate = `translate(${this.xScale(i) + op.cellPadding / 2},${op.rowHeight / 2})`;

            return (scale < 1 ? `${translate}scale(${scale},1)` : translate);
        };

        const rows = this.layers.wmMatrix.selectAll('.row').data(rowData, d => d.rowId);
        rows.exit().remove();

        const newRows = rows.enter().append('g').attr('class', 'row');

        const allRows = newRows.merge(rows);
        allRows.attr('transform', (d, i) => `translate(0,${this.yScale(i)})`);

        const words = allRows.selectAll('.word').data(d => d.words);
        words.exit().remove();
        words.enter().append('text')
          .attrs({class: 'word'})
          .merge(words)
          .attr("transform", wordTransform)
          .text(d => d.word)
    }

    _renderHeatmap(wordMatrix, heatmap) {
        const op = this.options;

        const hover = active => d =>
          this.eventHandler.trigger(WordMatrix.events.cellHovered,
            {col: d.y, row: d.x, active: active});

        const rows = this.layers.wmBackground.selectAll('.row').data(wordMatrix, d => d.rowId)
        rows.exit().remove();

        const newRows = rows.enter().append('g').attr('class', 'row');
        const allRows = newRows.merge(rows);
        allRows.attr('transform', (d, i) => `translate(0,${i * this.options.rowHeight})`);

        const rects = allRows.selectAll('.bgCell').data((r, x) => r.words.map((_, y) => ({x, y})));
        rects.exit().remove();
        rects.enter().append('rect')
          .merge(rects)
          .attrs({
              x: (d, i) => this.xScale(i),
              y: 0,
              width: op.cellWidth,
              height: op.cellHeight,
              class: d => `bgCell x${d.x} y${d.y}`
          })
          .styles({
              fill: d => heatmap[d.x][d.y]
          })
          .on('mouseover', hover(true))
          .on('mouseout', hover(false));

    }

    _renderPadding(leftPadding) {
        const rData = leftPadding > -1 ? [leftPadding] : [];

        const paddingLine = this.layers.overlay.selectAll('.paddingLine').data(rData);
        paddingLine.exit().remove();

        paddingLine.enter().append('line').attr('class', 'paddingLine')
          .merge(paddingLine).attrs({
            x1: d => this.xScale(d) - 3,
            x2: d => this.xScale(d) - 3,
            y1: 0,
            y2: this.yScale.range()[1]
        })
    }


    _bindLocalEvents(handler) {
        this._bindEvent(handler, WordMatrix.events.cellHovered,
          e => this.actionCellHovered(e.row, e.col, e.active))
    }

    actionChangeHeatmap(heatmap) {
        this.renderData.heatmap = heatmap || this.data.wordMatrix.map(row => row.words.map(() => '#fff'))
        this._render(this.renderData);
    }

    actionCellHovered(x, y, select) {
        const hovered = this.layers.wmBackground.selectAll(".x" + x + ".y" + y);
        hovered.classed('hovered', select);
    }


}

WordMatrix;
