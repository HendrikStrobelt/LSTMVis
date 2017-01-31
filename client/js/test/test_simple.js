/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/4/16.
 */
class Tester {

    static test_simple() {
        const v = d3.select('#vis');
        const sv = new SimpleComponent({parent: v, options: {}});
    }


    static test_heatmap() {

        const v = d3.select('#heat');
        const eventHandler = new SimpleEventHandler(v.node());

        const heatmaps = [];
        for (const i of [0, 1]) {
            const hm = new HeatMap({
                parent: v,
                eventHandler,
                options: {
                    title: 'HeatMap ' + i,
                    pos: {x: 0, y: 40 + i * 100},
                    bindEventsAutomatically:false
                }
            });
            hm.update({
                labels: [["a" + i, "b" + i, "cd", "ef"],
                    ["g", "h", "i" + i, "j"]],
                values: [[10 * i, 0, 1, 5],
                    [10, -3 * i, 10, 2]]
            });

            heatmaps.push(hm);

        }

        // Mutual exclusive selection of rect
        eventHandler.bind(`${HeatMap.events.rectSelected}`, hm_id => {
              const idSet = new Set([hm_id]);
              heatmaps.forEach(hm => hm.actionRectSelect(idSet));
          }
        )

        // Binding multiple events
        eventHandler.bind(
          `${HeatMap.events.rectSelected} ${HeatMap.events.cellHovered}`,
          (d, e) => console.log(d, e.type)
        )

        console.log(eventHandler.getListeners());


    }

    static test_lineplot() {
        const v = d3.select('#line');
        const eventHandler = new SimpleEventHandler(v.node());

        const data = [
            {index: 0, values: [0.1, 0.3, 0.2]},
            {index: 1, values: [0.4, 0.6, 0.1]},
            {index: 2, values: [0.5, 0.62, 0.9]}
        ];

        const sv = new LinePlot({parent: v, eventHandler, options: {}});
        sv.update({
            timeSteps: 3,
            cellValues: data,
            selectedCells: [0, 1, 2],
            deselectedCells: []
        });
        sv.actionUpdateThreshold(0.1);


        eventHandler.bind(LinePlot.events.thresholdChanged, ({newValue}) => {
            const selectedCells = data.filter(d => d.values[1] >= newValue).map(d => d.index);
            sv.update({
                timeSteps: 3,
                cellValues: data,
                selectedCells,
                deselectedCells: []
            })
        })


    }


    static test_wordseq() {
        const v = d3.select('#wordseq');
        const ws = new WordSequence({parent: v, options: {}});
        const words = ['hello', 'world', 'gIL', 'a', 'beautiful', 'day', '!'];
        ws.update({
            words: words
        })

        var cellWidth = 35;

        d3.select('#wordseq_inc')
          .on('click', () => {
              cellWidth += 5;
              ws.updateOptions({
                  options: {cellWidth: cellWidth},
                  reRender: true
              })
          })

        d3.select('#wordseq_dec')
          .on('click', () => {
              cellWidth -= 5;
              cellWidth = Math.max(5, cellWidth);
              ws.updateOptions({
                  options: {cellWidth: cellWidth},
                  reRender: true
              })
          })

        d3.select('#wordseq_color')
          .on('click', () => {
              const cs = d3.scaleLinear().range(['white', 'red']);
              const rand = d3.randomUniform(1);
              const colors = words.map(() => cs(rand()))
              ws.actionChangeWordBackgrounds(colors)
          })

    }

}

Tester.test_simple();
Tester.test_heatmap();
Tester.test_lineplot();
Tester.test_wordseq();

