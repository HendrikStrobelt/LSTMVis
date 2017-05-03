/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/11/17.
 */

class LSTMHeatmapHandler {

    static get events() {
        return {
            newMappedHM: 'hmh_newmapped'
        }
    }

    constructor({parentNode, controller, eventHandler, globalEventHandler, colorManager}) {
        this.parentNode = parentNode;
        this.controller = controller;
        this.eventHandler = eventHandler;
        this.globalEventHandler = globalEventHandler;
        this.colorManager = colorManager;

        this.metaOptionPanel = d3.select('#metaOptions');
        this.maskOptionButton = d3.select('#matchingMask');
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


        this.maskOptionButton.on("click", () => {
            const m = this.maskOptionButton;
            m.classed('activeOption', !m.classed('activeOption'));
            this.eventHandler.trigger(LSTMHeatmapHandler.events.newMappedHM, {});
        });


        this.globalEventHandler.bind(LSTMController.events.windowResize, () => this.updateVisibility())

        this.eventHandler.bind(HeatMap.events.closeWindow,
          hm => this.swapVisibility(hm.options.key)
        );

        this.eventHandler.bind(HeatMap.events.rectSelected,
          hmID => {
              this.mappedHM = hmID;
              this.eventHandler.trigger(LSTMHeatmapHandler.events.newMappedHM, {});
          }
        );


    }

    updateMetaOptions() {

        const metaInfo = this.controller.projectMetas
          .filter(d => d.type === 'discrete' || d.type === 'scalar');
        const metaKeys = ['match count', ...metaInfo.map(d => d.key)];
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
          .classed('activeOption', d => this.hmInfo.get(d).selected)
          .text(d => d);

    }

    swapVisibility(key) {
        const selected = !this.hmInfo.get(key).selected;
        this.hmInfo.get(key).selected = selected;
        this.metaOptionPanel.selectAll('.metaOption')
          .filter(d => d == key)
          .classed('activeOption', selected);
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
                    colorManager: this.colorManager
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


    get bgColorMap() {
        const heatmap = this.getHeatmapById(this.mappedHM);
        const cchm = this.cellCountHM;
        const cs = cchm.renderData.colorScale.copy().range([0.1, 1])
        const ccData = cchm.data.values;

        const maskHM = this.maskHeatmap;
        console.log(maskHM,'\n-- maskHM --');

        if (heatmap) {
            const colorScale = heatmap.renderData.colorScale;

            return heatmap.data.values
              .map((row, ri) => row.map((cell, ci) => {
                  const color = d3.color(colorScale(cell));
                  if (maskHM && (heatmap !== cchm)) color.opacity = cs(ccData[ri][ci]);

                  return color;
              }));

        }

        // Else:
        return null;
    }


    get maskHeatmap() {
        return this.maskOptionButton.classed('activeOption');
    }


    actionCellHovered(x, y, active) {
        this.hmInfo.forEach(hm => hm.heatmap.actionHoverCell(y, x, active))
    }


}

LSTMHeatmapHandler;
