/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/22/17.
 */

class ModalDialog {

    static get events() {
        return {
            modalDialogCanceled: 'modalDialogCanceled',
            modalDialogSubmitted: 'modalDialogSubmitted'
        }
    }

    static open({rootNode, eventHandler, width = 300}) {

        // Bind the buttons

        rootNode.selectAll('.uiCancel')
          .on('click', () => {
              ModalDialog.close({rootNode});
              eventHandler.trigger(ModalDialog.events.modalDialogCanceled, rootNode);
          });


        rootNode.selectAll('.uiSubmit')
          .on('click', () => {
              eventHandler.trigger(ModalDialog.events.modalDialogSubmitted, rootNode);
          });

        // Make it appear nicely :)

        d3.select('body').append('div')
          .attr('class', 'inactivator')
          .styles({opacity: 0})
          .transition().style('opacity', 0.5)

        rootNode.attr('hidden', null)
        const dialogHeight = rootNode.node().clientHeight;
        rootNode
          .raise()
          .style('width', `${width}px`)
          .style('opacity', 1)
          .style('top', `${-dialogHeight}px`)
          .style('left', `${(window.innerWidth - width) / 2}px`)


        rootNode.transition()
          .style('top', '5px')


    }

    static close({rootNode}) {
        d3.selectAll('.inactivator').remove();

        const dialogHeight = rootNode.node().clientHeight;

        rootNode.transition()
        // .duration(2000)
          .style('top', `${-dialogHeight}px`)
          .style('opacity', 0)
          .on('end', function () {
              d3.select(this).attr('hidden', true)
          })
    }


}

ModalDialog;
