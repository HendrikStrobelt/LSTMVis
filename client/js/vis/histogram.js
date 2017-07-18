/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 3/21/17.
 */
class Histogram extends VComponent {

    static get events() {
        return {
            binClicked: 'histo_bin-lciked',
            binHovered: 'histo_bin-hivrer',
        }
    }

    get defaultOptions() {
        return {
            colors: ['rgba(255, 255, 255, 0.4)', 'rgba(255, 5, 255, 1)'], //MOve to CSS
            binWidth: 15,
            binPadding: 2,
            height: 100
        }
    }

    get layout() {
        return [
            {name: 'bg', pos: {x: 0, y: 0}},
            {name: 'histoBG', pos: {x: 0, y: 0}},
            {name: 'histoFG', pos: {x: 0, y: 0}},
            {name: 'overlay', pos: {x: 0, y: 0}}
        ]
    }

    get _dataFormat() {
        return {
            valuesBg: [2, 3], //Render in background
            values: [1, 2]
        }
    }

    _wrangle(data) {
        const op = this.options;

        let maxY = d3.max(data.values);
        if (data.valuesBg) {
            maxY = d3.max([maxY, ...data.valuesBg]);
        }

        this._states.hasBGdata = 'valuesBg' in data;
        this._states.yScale = d3.scaleLinear().domain([0, maxY]).range([op.height, 0]);

        this._states.xScale = d3.scaleLinear().range([0, (op.binWidth + op.binPadding)]);

        return data;
    }

    _init() {
        this.label =
          this.layers.overlay.append('text').attrs({
              'class': 'histoLabelText',
              x: 0,
              y: 0
          }).style('hidden', true)
    }

    _renderBars({selection, classLabel}) {
        const st = this._states;
        const op = this.options;

        selection.exit().remove();

        return selection.enter().append('rect').attr('class', classLabel)
          .merge(selection)
          .attrs({
              x: (d, i) => st.xScale(i),
              y: d => st.yScale(d),
              width: op.binWidth,
              height: d => op.height - st.yScale(d)
          })
    }

    _render(renderData) {
        const st = this._states;

        const histoFG = this.layers.histoFG.selectAll('.histoBar').data(renderData.values);
        this._renderBars({selection: histoFG, classLabel: 'histoBar'});

        const histoBG = this.layers.histoBG.selectAll('.histoBar').data(st.hasBGdata ? renderData.valuesBg : []);
        this._renderBars({selection: histoBG, classLabel: 'histoBar'});

        const histoReact = this.layers.bg.selectAll('.histoReact')
          .data(renderData.values.map(() => st.yScale.domain()[1]));

        this._renderBars({selection: histoReact, classLabel: 'histoReact'})
          .on('mouseenter', (d, i) => this.eventHandler.trigger(Histogram.events.binHovered, i))
          .on('mouseleave', () => this.eventHandler.trigger(Histogram.events.binHovered, -1))
          .on('click', (d, i) => this.eventHandler.trigger(Histogram.events.binClicked, i))


    }

    _bindLocalEvents() {

        this._bindEvent(this.eventHandler, Histogram.events.binHovered, d => this.actionShowLabel(d));
        this._bindEvent(this.eventHandler, Histogram.events.binClicked, d => console.log(d,'\n-- d --') );

    }


    actionShowLabel(binID) {
        const st = this._states;
        if (binID < 0) {
            this.label.text('')
        } else {
            const dt = this.data;
            this.label.attrs({
                x: st.xScale(binID + 1)
            }).text(st.hasBGdata ? `${binID}: ${dt.values[binID]}/${dt.valuesBg[binID]}` : `${binID}: ${dt.values[binID]} `)
        }
    }


}

Histogram;
