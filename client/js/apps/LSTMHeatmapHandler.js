/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/11/17.
 */

class LSTMHeatmapHandler {

    constructor({parentNode, controller, eventHandler}) {
        this.parentNode = parentNode;
        this.controller = controller;
        this.eventHandler = eventHandler;
    }

    init() {
        this.cellCountHM = new HeatMap({
            parent: this.parentNode, eventHandler: this.eventHandler,
            options: {
                title: 'match count',
                pos: {x: 400, y: 20}
            }
        })

        this.hmInfo = new Map();

        this.eventHandler.bind(LSTMController.events.windowResize, () => this.updateVisibility())

    }

    updateMetaOptions() {
        const that = this;

        const metaInfo = this.controller.projectMetadata.meta;
        const metaKeys = ['match count', ...Object.keys(metaInfo)];
        const mOp = d3.select('#metaOptions').selectAll('.metaOption')
          .data(metaKeys);
        mOp.exit().each(d => {
            this.hmInfo.get(d).heatmap.destroy();
            this.hmInfo.remove(d);
        }).remove();

        mOp.enter().append('span').attr('class', 'metaOption noselect')
          .each(d => this._heatmapAdd(d))
          .on('click', function (d) {
              const selected = !that.hmInfo.get(d).selected;
              that.hmInfo.get(d).selected = selected;
              d3.select(this).classed('activeHM', selected);
              that.updateVisibility();
          })
          .style('padding-right', '2px')
          .merge(mOp)
          .classed('activeHM', d => this.hmInfo.get(d).selected)
          .text(d => d);

    }

    _heatmapAdd(key) {
        if (key == 'match count') {
            this.hmInfo.set(key, {
                selected: true,
                heatmap: this.cellCountHM
            })
        } else {
            const metaInfo = this.controller.projectMetadata.meta[key];
            const hmType =
              (metaInfo.vis.type == 'scalar') ? HeatMap.chartType.scalar : HeatMap.chartType.categorical;

            const heatmap = new HeatMap({
                parent: this.parentNode, eventHandler: this.eventHandler,
                options: {
                    title: key,
                    pos: {x: 450, y: 20},
                    chartType: hmType
                }
            });

            heatmap.hideView();
            this.hmInfo.set(key, {
                selected: false,
                heatmap: heatmap
            })
        }
    }


    updateVisibility() {

        const visKeys = [];
        this.hmInfo.forEach((item, key) => {
            if (item.selected) {
                visKeys.push(key);
                item.heatmap.unhideView();
            } else {
                item.heatmap.hideView();
            }
        });

        let offset = this.controller.windowSize.width;
        visKeys.forEach(key => offset -= this.hmInfo.get(key).heatmap.currentWidth);
        visKeys.forEach(key => {
            const hm = this.hmInfo.get(key).heatmap;
            hm.actionSetPos({x: offset, y: 20});
            offset += hm.currentWidth;
        })


    }


    updateHeatmapData() {

        this.cellCountHM.update({values: this.controller.matchingCellCount});

        const allDims = this.controller.matchingMetaDims;
        Object.keys(allDims).forEach(dim => {
            const hm = this.hmInfo.get(dim);
            if (hm) {
                hm.heatmap.update({
                    values: allDims[dim]
                })
            }
        })

    }


}

LSTMHeatmapHandler;
