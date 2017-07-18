/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 12/8/16.
 */


class WordSequence extends VComponent {

    static get events() {
        return {
            brushSelectionChanged: 'wordsequence_brushSelChanged',
            zeroBrushSelectionChanged: 'wordsequence_zeroBrushSelChanged',
            wordHovered: 'wordsequence_wordHovered',
            wordClicked: 'wordsequence_wordClicked',
            updateWordSelection: 'wordsequence_upwordsel'
        }
    }

    static get modes() {
        return {
            brushing: ['zeroBrush', 'brushSelect', 'hovering'],
            multiSelect: ['multiSelect', 'hovering'],
            simple: ['hovering']
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 10, y: 10},
            cellWidth: 35,
            cellPadding: 4,
            cellHeight: 20,
            mode: WordSequence.modes.brushing
        }
    }

    get layout() {
        return [
            {name: 'measure', pos: {x: 0, y: -10}},
            {name: 'text', pos: {x: 0, y: 0}},
            {name: 'overlay', pos: {x: 0, y: 0}},
            {name: 'brush', pos: {x: 0, y: 0}},
            {name: 'zeroBrush', pos: {x: 0, y: 25}}
        ]
    }

    _init() {
        const svgMeasure = new SVGMeasurements(this.layers.measure, 'word');
        this._calcTextLength = text => svgMeasure.textLength(text);
    }


    _wrangle(data) {
        this._states.selectedRange = data.wordBrush;
        this._states.zeroBrushSelection = data.wordBrushZero;
        this._states.colorArray = data.colorArray || [];

        this._states.selectedWords = new Set();

        return {
            words: data.words.map((d, i) =>
              ({text: d, index: i, length: this._calcTextLength(d)})),
            leftPadding: data.leftPadding || -1
        };
    }

    _render(renderData) {
        const op = this.options;
        const st = this._states;
        const wordCount = renderData.words.length;

        this.base.attr('transform', `translate(${op.pos.x},${op.pos.y})`);


        st.xScale = d3.scaleLinear()
          .domain([0, wordCount])
          .range([0, wordCount * op.cellWidth]);

        op.mode.forEach(d => st[d] = true);

        this._renderWords({words: renderData.words, op, st});
        this._renderPadding(renderData.leftPadding);

        if (st.brushSelect) this._renderBrush({op, st});
        if (st.zeroBrush) this._renderZeroBrush({op, st});


    }

    _renderPadding(leftPadding) {
        const rData = leftPadding > -1 ? [leftPadding] : [];

        const paddingLine = this.layers.overlay.selectAll('.paddingLine').data(rData);
        paddingLine.exit().remove();

        paddingLine.enter().append('line').attr('class', 'paddingLine')
          .merge(paddingLine).attrs({
            x1: d => this._states.xScale(d) - 1,
            x2: d => this._states.xScale(d) - 1,
            y1: 0,
            y2: this.options.cellHeight
        })


    }


    _renderWords({words, op, st}) {
        const xScale = st.xScale;
        let word = this.layers.text.selectAll(".word").data(words);
        word.exit().remove();

        // --- adding Element to class word
        const wordEnter = word.enter().append("g");
        wordEnter.append('rect');
        wordEnter.append('text');

        word = wordEnter.merge(word);
        word
          .attr("class", d => `word noselect word_${d.index}`)
          .attr('transform', (d, i) => `translate(${xScale(i)},0)`)
          .classed('selected', d => ('selectedWords' in st) && st.selectedWords.has(d.index))

        word.select('text').text(d => d.text);

        const rects = word.select('rect')
          .attrs({y: 0, width: op.cellWidth, height: op.cellHeight})

        if ('colorArray' in st) {
            rects.style('fill', d => (d.index < st.colorArray.length) ? st.colorArray[d.index] : null);
        } else {
            rects.style('fill', null);
        }

        word.select('text')
          .attr("transform", d => {
              const scaleX = (op.cellWidth - op.cellPadding) / d.length;
              const translate = `translate(${op.cellWidth / 2},${op.cellHeight / 2})`

              return (scaleX < 1 ? `${translate}scale(${scaleX},1)` : translate);
          });

        if (st.multiSelect) {
            word.on('click',
              d => this.eventHandler.trigger(WordSequence.events.wordClicked, d.index))
        }

        if (st.hovering && !st.brushSelect) {
            word.select('rect')
              .on('mouseenter',
                d => this.eventHandler.trigger(WordSequence.events.wordHovered, d.index))
            this.layers.text.on('mouseout',
              () => this.eventHandler.trigger(WordSequence.events.wordHovered, -1))
        }

    }

    _renderBrush({op, st}) {
        const xScale = st.xScale;
        // Indicates if brush is moved or newly created
        let moveBrush = false;

        const brushed = () => {
            const ev = d3.event;

            if (ev.sourceEvent && ev.sourceEvent.type === 'mousemove') {
                const rangeRaw = d3.event.selection
                  .map(xScale.invert)
                const range = rangeRaw.map(d => Math.round(d));

                // If not a brush moving event: ceil and floor
                if (!moveBrush) {
                    range[0] = Math.floor(rangeRaw[0]);
                    range[1] = Math.round(rangeRaw[1]);
                }

                // Set internal state to minimize emitting change events
                const sameRange = (a, b) => (a[0] === b[0]) && (a[1] === b[1]);
                const deepAssign = (a, b) => {
                    a[0] = b[0];
                    a[1] = b[1]
                };

                if (!st.selectedRange) st.selectedRange = [-1, -1];

                if (!sameRange(st.selectedRange, range)) {
                    deepAssign(st.selectedRange, range);
                    this.eventHandler.trigger(
                      WordSequence.events.brushSelectionChanged, range);
                }

                // Update the selection indicators
                d3.event.target.move(this.layers.brush, range.map(xScale));
            }

        };

        const brushEnd = () => {
            const ev = d3.event;
            // Only catch events that clear selection
            if (ev.sourceEvent && ev.sourceEvent.type === 'mouseup') {
                if (ev.type === 'end' && ev.selection === null) {
                    st.selectedRange = undefined;
                    this.eventHandler.trigger(
                      WordSequence.events.brushSelectionChanged, null);
                }
            }
        }

        const brushStart = () => {
            const ev = d3.event;
            if (ev.selection) {
                moveBrush = ev.selection[0] !== ev.selection[1];
            }
        };

        const brushGenerator = d3.brushX()
          .extent([[xScale.range()[0], 3], [xScale.range()[1], op.cellHeight - 3]])
          .on("start", brushStart)
          .on("brush", brushed)
          .on("end", brushEnd);

        this.layers.brush.call(brushGenerator);

        const ol = this.layers.brush;

        if (st.hovering) {
            ol.on('mousemove', () => {
                const wordNo = Math.floor(xScale.invert(d3.mouse(ol.node())[0]));
                if (st.wordHovered !== wordNo) {
                    st.wordHovered = wordNo;
                    this.eventHandler.trigger(WordSequence.events.wordHovered, wordNo)
                }
            });

            ol.on('mouseout', () => {
                st.wordHovered = null;
                this.eventHandler.trigger(WordSequence.events.wordHovered, -1)

            });
        }
        if (st.selectedRange)
            brushGenerator.move(this.layers.brush, st.selectedRange.map(xScale));
        else
            brushGenerator.move(this.layers.brush, [0, 0]);


    }

    _renderZeroBrush({op, st}) {
        this.layers.zeroBrush.attr('transform', SVG.translate({x: 0, y: op.cellHeight + 5}));

        const xScale = st.xScale;
        const sr = st.selectedRange;

        const dragging = () => {
            const ev = d3.event;
            const subject = ev.subject;
            const zbl = this.layers.zeroBrush;

            let newB = Math.max(-1, Math.round(xScale.invert(ev.x + 3)))

            let valueChanged = false;
            if (subject.handle === 'l') {
                if (newB > sr[0]) newB = sr[0];
                const diff0 = sr[0] - newB;
                valueChanged = (st.zeroBrushSelection[0] != diff0)
                st.zeroBrushSelection[0] = diff0
            } else if (subject.handle === 'r') {
                if (newB < sr[1]) newB = sr[1];
                const diff1 = newB - sr[1];
                valueChanged = (st.zeroBrushSelection[1] != diff1)
                st.zeroBrushSelection[1] = diff1;
            }

            if (valueChanged)
                this.eventHandler.trigger(WordSequence.events.zeroBrushSelectionChanged, st.zeroBrushSelection);


            const newX = xScale(newB) - 3;
            zbl.selectAll(`.zeroHandle.handle-${subject.handle}`).attr('x', newX)
            const wisker = zbl.selectAll(`.zeroWisker.handle-${subject.handle}`)
            if (subject.handle === 'l') wisker.attr('x1', newX)
            else wisker.attr('x2', newX)


        };

        const dragEnd = () => {
            this._renderZeroBrush({op: this.options, st: this._states})
        }

        if (sr) {
            st.zeroBrushSelection = st.zeroBrushSelection || [1, 0];
            const zbs = st.zeroBrushSelection;
            const ext = [
                {l: sr[0] - zbs[0], r: sr[0], handle: 'l'},
                {l: sr[1], r: sr[1] + zbs[1], handle: 'r'}]

            const zHandles = this.layers.zeroBrush.selectAll('.zeroHandle').data(ext, d => d.handle);
            zHandles.exit().remove()
            zHandles.enter().append('rect').attr('class', d => 'zeroDeco zeroHandle handle-' + d.handle)
              .merge(zHandles)
              .attrs({
                  x: d => xScale(d[d.handle]) - 3,
                  y: op.cellHeight / 2,
                  height: op.cellHeight / 2,
                  width: 6
              }).call(d3.drag()
              .on('drag', dragging)
              .on('end', dragEnd));

            const zWisker = this.layers.zeroBrush.selectAll('.zeroWisker').data(ext);
            zWisker.exit().remove()
            zWisker.enter().append('line').attr('class', d => 'zeroDeco zeroWisker handle-' + d.handle)
              .merge(zWisker)
              .attrs({
                  x1: d => xScale(d.l),
                  x2: d => xScale(d.r),
                  y1: op.cellHeight - 3,
                  y2: op.cellHeight - 3
              });

            const signatureLineData = [
                [sr[0], op.cellHeight - 3],
                [sr[0], 3],
                [sr[1], 3],
                [sr[1], op.cellHeight - 3]
            ]
            const signatureLine = d3.line().x(d => xScale(d[0])).y(d => d[1])

            const sl = this.layers.zeroBrush.selectAll('.signatureLine').data([signatureLineData])
            sl.enter().append('path').attr('class', 'zeroDeco signatureLine')
              .merge(sl)
              .attr('d', signatureLine)


        } else {
            this.layers.zeroBrush.selectAll('.zeroDeco').remove();
        }


    }


    _bindLocalEvents(handler) {
        const ev = WordSequence.events;

        this._bindEvent(handler, ev.brushSelectionChanged, () => {
            const st = this._states;
            if (st.zeroBrush)
                this._renderZeroBrush({op: this.options, st: st})
        });

        this._bindEvent(handler, ev.zeroBrushSelectionChanged,
          d => console.log('sss', d)
        );

        this._bindEvent(handler, ev.wordHovered,
          wordNo => this.actionWordHovered(wordNo));

        handler.bind(ev.wordClicked, wordIndex => {
            const st = this._states;
            const sw = st.selectedWords;

            if (sw.has(wordIndex)) sw.delete(wordIndex);
            else sw.add(wordIndex);

            this._renderWords({renderData: this.renderData, op: this.options, st})

            handler.trigger(ev.updateWordSelection, [...sw])

        });

    }


    actionChangeWordBackgrounds(colorArray) {
        if (colorArray) {
            this._states.colorArray = colorArray;
        } else {
            delete this._states.colorArray;
        }

        this._renderWords({words: this.renderData.words, op: this.options, st: this._states});
    }

    actionWordHovered(wordNo) {
        this.layers.text.selectAll('.word')
          .classed('hovered', d => d.index === wordNo)
    }
}

WordSequence;
