/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/11/17.
 */

class LSTMHeatmapHandler {

    constructor({parentNode, controller, eventHandler, generalEventHandler, metaOptionPanel, colorManager}) {
        this.parentNode = parentNode;
        this.controller = controller;
        this.eventHandler = eventHandler;
        this.metaOptionPanel = metaOptionPanel;
        this.generalEventHandler = generalEventHandler;
        this.colorManager = colorManager;

    }

    init() {
        this.cellCountHM = new HeatMap({
            parent: this.parentNode, eventHandler: this.eventHandler,
            options: {
                key: 'match count',
                title: 'match count',
                pos: {x: 400, y: 20},
                globalExclusiveEvents: [HeatMap.events.cellHovered]
            }
        });

        this.hmInfo = new Map();

        this.generalEventHandler.bind(LSTMController.events.windowResize, () => this.updateVisibility())

        this.eventHandler.bind(HeatMap.events.closeWindow,
          hm => this.swapVisibility(hm.options.key)
        )

    }

    updateMetaOptions() {

        const metaInfo = this.controller.projectInfo.meta;
        const metaKeys = ['match count', ...Object.keys(metaInfo)];
        const mOp = this.metaOptionPanel.selectAll('.metaOption').data(metaKeys);
        mOp.exit().each(d => {
            this.hmInfo.get(d).heatmap.destroy();
            this.hmInfo.remove(d);
        }).remove();

        mOp.enter().append('button').attr('class', 'metaOption noselect')
          .each(d => this._heatmapAdd(d))
          .on('click', d => this.swapVisibility(d))
          // .style('padding-right', '2px')
          .merge(mOp)
          .classed('activeHM', d => this.hmInfo.get(d).selected)
          .text(d => d);

    }

    swapVisibility(key) {
        const selected = !this.hmInfo.get(key).selected;
        this.hmInfo.get(key).selected = selected;
        this.metaOptionPanel.selectAll('.metaOption')
          .filter(d => d == key)
          .classed('activeHM', selected);
        this.updateVisibility();

    }

    _heatmapAdd(key) {
        if (key == 'match count') {
            this.hmInfo.set(key, {
                selected: true,
                heatmap: this.cellCountHM
            })
        } else {
            const metaInfo = this.controller.projectInfo.meta[key];
            const hmType =
              (metaInfo.vis.type == 'scalar') ? HeatMap.chartType.scalar : HeatMap.chartType.categorical;

            const heatmap = new HeatMap({
                parent: this.parentNode, eventHandler: this.eventHandler,
                options: {
                    key,
                    title: key,
                    pos: {x: 450, y: 20},
                    chartType: hmType,
                    globalExclusiveEvents: [HeatMap.events.cellHovered],
                    colorManager:this.colorManager
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
        visKeys.forEach(key => offset -= this.hmInfo.get(key).heatmap.currentWidth + 5);
        visKeys.forEach(key => {
            const hm = this.hmInfo.get(key).heatmap;
            hm.actionSetPos({x: offset, y: 20});
            offset += hm.currentWidth + 5;
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
        });
        this.updateVisibility();

    }


    getHeatmapById(hmID) {
        let res = null;
        this.hmInfo.forEach(hm => {
            if (hm.heatmap.id === hmID) res = hm.heatmap
        })

        return res;
    }

    actionCellHovered(x, y, active) {
        this.hmInfo.forEach(hm => hm.heatmap.actionHoverCell(y, x, active))
    }


}

LSTMHeatmapHandler;
