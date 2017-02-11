/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/9/17.
 */


class WordMatrix extends VComponent {

    static get events() {
        return {}
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
            {name: 'heatmap', pos: {x: 0, y: 0}},
            {name: 'matrix', pos: {x: 0, y: 0}},
            {name: 'overlay', pos: {x: 0, y: 0}}
        ]
    }

    _init() {
        const svgMeasure = new SVGMeasurements(this.layers.measure);
        this._calcTextLength = text => svgMeasure.textLength(text);

    }


    _wrangle(data) {
        this._states.heatmap = data.heatmap;

        return {
            wordMatrix: data.wordMatrix.map(
              (row, index) => {
                  const words = row.words.map(word => ({word, length: this._calcTextLength(word)}));

                  return {posOffset: row.posOffset || 0, rowId: row.rowId || index, words}
              })
        };
    }


    _render(renderData) {
        this._renderWords(renderData.wordMatrix);
    }

    _renderWords(rowData) {
        const op = this.options;

        const wordTransform = (d, i) => {
            const scale = (op.cellWidth - op.cellPadding / 2) / d.length || 1;
            const translate = `translate(${i * op.cellWidth + op.cellPadding / 2},${op.cellHeight / 2})`;

            return (scale < 1 ? `${translate}scale(${scale},1)` : translate);
        };

        const rows = this.layers.matrix.selectAll('.row').data(rowData, d => d.rowId);
        rows.exit().remove();

        const newRows = rows.enter().append('g').attr('class', 'row');

        const allRows = newRows.merge(rows);
        allRows.attr('transform', (d, i) => `translate(0,${i * this.options.rowHeight})`);

        const words = allRows.selectAll('.word').data(d => d.words)
        words.exit().remove();
        words.enter().append('text')
          .attrs({class: 'word'})
          .merge(words)
          .attr("transform", wordTransform)
          .text(d => d.word)

    }


    _bindLocalEvents() {

    }

}

WordMatrix;
