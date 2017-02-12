/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/9/17.
 */


class CellList extends VComponent {

    static get events() {
        return {
            cellHovered: 'CellList_hover',
            cellClicked: 'CellList_clicked',
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 0, y: 0}
        }
    }

    get layout() {
        return []
    }

    _wrangle(data) {
        this._states.highlighted = data.highlighted;

        return {cells: data.cells.map(d => d).sort((a, b) => a - b)}
    }

    _init() {
        CellList;
    }

    _render(renderData) {
        const hover = active => d =>
          this.eventHandler.trigger(CellList.events.cellHovered,
            {index: active ? d : -1});

        const cells = this.base.selectAll('.cell').data(renderData.cells);
        cells.exit().remove();

        const cellG = cells.enter().append('g').attr('class', 'cell');
        cellG.append('rect').attrs({width: 30, height: 20, rx: 2, ry: 2});
        cellG.append('text').attrs({x: 15, y: 10});
        cellG
          .on('mouseenter', hover(true))
          .on('mouseout', hover(false));

        const allCells = cellG.merge(cells);

        allCells.attr('transform', (d, i) => `translate(${i * 32},0)`);
        allCells.select('text').text(d => d);
        this.allCells = allCells

    }

    actionCellHovered(cell) {
        if (cell < 0) {
            this.allCells.classed('hovered', null);
        } else {
            this.allCells.classed('hovered', d => d === cell)
        }
    }

    _bindLocalEvents(handler) {
        this._bindEvent(handler, CellList.events.cellHovered,
          d => this.actionCellHovered(d.index))
    }

}

CellList;
