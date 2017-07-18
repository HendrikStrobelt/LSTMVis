/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 3/8/17.
 */
class ButtonMatrix extends VComponent {

    static get events() {
        return {
            buttonClicked: 'btnmatrxi-clicked'
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 0, y: 0},
            cellWidth: 35,
            cellHeight: 20,
            additionalClasses: '',
            buttonText: ''
        }
    }

    get layout() {
        return [
            // {name: 'bg', pos: {x: 0, y: 0}},
            // {name: 'text', pos: {x: 0, y: 0}}
        ]
    }

    _init() {
        null;
    }

    _wrangle(data) {
        return data;
    }

    _render(renderData) {
        let rows = this.base.selectAll('.row').data(renderData);
        rows.exit().remove();

        rows = rows.enter().append('g').attrs({
            class: 'row'
        }).merge(rows).attrs({
            'transform': (d, i) => SVG.translate({x: 0, y: i * this.options.cellHeight})
        });

        let cells = rows.selectAll('.svg_btn').data(d => d)
        cells.exit().remove();

        cells = cells.enter().append('g')
          .each(function () {
              const me = d3.select(this);
              me.append('rect');
              me.append('text');
          })
          .merge(cells).attr('class', 'svg_btn ' + this.options.additionalClasses)
          .attrs({
              'transform': (d, i) => SVG.translate({y: 0, x: i * this.options.cellWidth})
          })

        cells.select('rect').attrs({
            width: this.options.cellWidth,
            height: this.options.cellHeight
        }).on('click', d =>
          this.eventHandler.trigger(ButtonMatrix.events.buttonClicked, {caller: this, value: d})
        );

        cells.select('text').attrs({
            x: this.options.cellWidth / 2,
            y: this.options.cellHeight / 2
        }).text(this.options.buttonText)

    }

    _bindLocalEvents() {
        null;
    }


}

ButtonMatrix;
