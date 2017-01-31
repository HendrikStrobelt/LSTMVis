/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 11/30/16.
 */

class SVG {
    static translate({x, y}) {return "translate(" + x + "," + y + ")"}

    static group(parent, classes, pos) {
        return parent.append('g').attrs({
            class: classes,
            "transform": SVG.translate(pos)
        })
    }

}

let the_unique_id_counter = 0;
class Util {
    static simpleUId({prefix = ''}) {
        the_unique_id_counter += 1;

        return prefix + the_unique_id_counter;
    }

    static vectorSum(a, b) {
        return a.map((d, i) => a[i] + b[i])
    }

    /**
     * Read all URL parameters into a map.
     * @returns {Map} the url parameters as a key-value store (ES6 map)
     */
    static getUrlParameters() {
        // Adapted from:  http://stackoverflow.com/questions/2090551/parse-query-string-in-javascript
        const query = window.location.search.substring(1);
        const vars = query.split('&');

        const urlParameters = new Map();

        vars.forEach(v => {
            if (v.length > 0) {
                const splits = v.split('=');
                const key = decodeURIComponent(splits[0]);
                urlParameters.set(key, decodeURIComponent(splits[1]));
            }

        });

        return urlParameters;

    }

    /**
     * Generates an URL string from a map of url parameters
     * @param {Map} urlParameters - the map of parameters
     * @returns {string} - an URI string
     */
    static generateUrlString(urlParameters) {
        const attr = [];
        urlParameters.forEach((v, k) => {
            if (v != undefined) {
                attr.push(encodeURI(k + '=' + v))
            }
        });


        const url = window.location.pathname;
        let res = url.substring(url.lastIndexOf('/') + 1);
        if (attr.length > 0) {
            res += '?' + attr.join('&')
        }

        return res;

    }

}

class Network {

    /**
     * Generates a Ajax Request object.
     * @param {string} url - the base url
     * @returns {{get: (function(*=)), post: (function(*=)), put: (function(*=)), delete: (function(*=))}}
     *  the ajax object that can call get, post, put, delete on the url
     */
    static ajax_request(url) {

        /* Adapted from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
         * EXAMPLE:

         var mdnAPI = 'https://developer.mozilla.org/en-US/search.json';
         var payload = {
            'topic' : 'js',
            'q'     : 'Promise'
         };

         var callback = {
            success: function(data) {
                console.log(1, 'success', JSON.parse(data));
            },
            error: function(data) {
                console.log(2, 'error', JSON.parse(data));
            }
         };

         // Executes the method call
         $http(mdnAPI)
         .get(payload)
         .then(callback.success)
         .catch(callback.error);

         // Executes the method call but an alternative way (1) to handle Promise Reject case
         $http(mdnAPI)
         .get(payload)
         .then(callback.success, callback.error);

         */

          // Method that performs the ajax request
        const ajax = (method, _url, args) => {

              // Creating a promise
              return new Promise((resolve, reject) => {

                  // Instantiates the XMLHttpRequest
                  const client = new XMLHttpRequest();
                  let uri = _url;

                  if (args && (method === 'POST' || method === 'GET' || method === 'PUT')) {
                      uri += '?';
                      for (const key of args) {
                          uri += '&';
                          uri += encodeURIComponent(key) + '=' + encodeURIComponent(args[key]);

                      }
                  }

                  // Debug: console.log('URI', uri, args);
                  client.open(method, uri);
                  client.send();
                  client.onload = function () {
                      if (this.status >= 200 && this.status < 300) {
                          // Performs the function "resolve" when this.status is equal to 2xx
                          resolve(this.response);
                      } else {
                          // Performs the function "reject" when this.status is different than 2xx
                          reject(this.statusText);
                      }
                  };
                  client.onerror = function () {
                      reject(this.statusText);
                  };
              });

          };

        // Adapter pattern
        return {
            'get': args => ajax('GET', url, args),
            'post': args => ajax('POST', url, args),
            'put': args => ajax('PUT', url, args),
            'delete': args => ajax('DELETE', url, args)
        };


    }
}


class SimpleEventHandler {
    constructor(element) {
        this.element = element;
        this.eventListeners = []
    }


    bind(eventNames, eventFunction) {
        for (const eventName of eventNames.split(' ')) {
            this.eventListeners.push({eventName, eventFunction});
            const eventFunctionWrap = e => eventFunction(e.detail, e);
            this.element.addEventListener(eventName, eventFunctionWrap, false);
        }
    }

    getListeners() {
        return this.eventListeners;
    }

    trigger(eventName, detail) {
        this.element.dispatchEvent(new CustomEvent(eventName, {detail}));
    }

}


SVG, Util, SimpleEventHandler, Network;
