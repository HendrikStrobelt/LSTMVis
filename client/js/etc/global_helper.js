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

    static objectMap(obj) {
        return new Map(Object.keys(obj).map(k => [k, obj[k]]))
    }

    static range(start, end) {
        return [...new Array(end - start)].map((v, i) => i + start);
    }

    // Adapted -- https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Math/round#PHP-Like_rounding_Method
    static round(number, precision) {
        const factor = Math.pow(10, precision);
        const tempNumber = number * factor;
        const roundedTempNumber = Math.round(tempNumber);

        return roundedTempNumber / factor;
    }

    static transpose(matrix) {

        const matrixHeight = matrix.length,
          matrixWidth = matrix[0].length,
          res = [];

        for (let i = 0; i < matrixWidth; i += 1) {
            res.push([]);
        }

        for (let i = 0; i < matrixHeight; i += 1) {
            for (let j = 0; j < matrixWidth; j++) {
                res[j].push(matrix[i][j]);
            }
        }

        return res;
    }


}


class SVGMeasurements {
    constructor(baseElement, classes = '') {
        this.measureElement = baseElement.append('text')
          .attrs({x: 0, y: -20, class: classes})

    }

    textLength(text) {
        this.measureElement.text(text);
        const tl = this.measureElement.node().getComputedTextLength();
        this.measureElement.text('');

        return tl;
    }
}

class URLHandler {

    static basicURL() {
        const url_path = window.location.pathname.split('/').slice(0, -2).join('/');

        return window.location.origin + (url_path.length ? url_path : '');
    }

    /**
     * Read all URL parameters into a map.
     * @returns {Map} the url parameters as a key-value store (ES6 map)
     */
    static parameters() {
        // Adapted from:  http://stackoverflow.com/questions/2090551/parse-query-string-in-javascript
        const query = window.location.search.substring(1);
        const vars = query.split('&');

        const urlParameters = new Map();

        const isInt = x => (/^[0-9]+$/).test(x);
        const isFloat = x => (/^[0-9]+\.[0-9]*$/).test(x);

        vars.forEach(v => {
            if (v.length > 0) {
                const splits = v.split('=');
                const key = decodeURIComponent(splits[0]);
                let raw_value = decodeURIComponent(splits[1]);

                const isArray = raw_value.startsWith('..');
                if (isArray) {
                    raw_value = raw_value.slice(2);
                }

                if (raw_value.length < 1) {
                    urlParameters.set(key, isArray ? [] : '');
                } else {
                    const [first, ...rest] = raw_value.split(',').map(val => {
                        if (isInt(val)) {
                            return Number.parseInt(val, 10);
                        } else if (isFloat(val)) {
                            return Number.parseFloat(val);
                        }

                        return val;
                    });
                    urlParameters.set(key, isArray ? [first, ...rest] : first);
                }
            }
        });

        return urlParameters;

    }

    static updateParameters(urlParameters) {
        const currentParams = URLHandler.parameters();
        currentParams.forEach((v, k) => urlParameters.set(k, v));
    }


    /**
     * Generates an URL string from a map of url parameters
     * @param {Map} urlParameters - the map of parameters
     * @returns {string} - an URI string
     */
    static urlString(urlParameters) {
        const attr = [];
        urlParameters.forEach((v, k) => {
            if (v != undefined) {
                let value = v;
                if (Array.isArray(v)) value = '..' + v.join(',');
                attr.push(encodeURI(k + '=' + value))
            }
        });


        const url = window.location.pathname;
        let res = url.substring(url.lastIndexOf('/') + 1);
        if (attr.length > 0) {
            res += '?' + attr.join('&')
        }

        return res;
    }

    static updateUrl({urlParameters, addToBrowserHistory = true}) {
        if (addToBrowserHistory) {
            window.history.pushState(urlParameters, '',
              URLHandler.urlString(urlParameters))
        } else {
            window.history.replaceState(urlParameters, '',
              URLHandler.urlString(urlParameters))
        }
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
                    args.forEach((value, key) => {
                          uri += '&';
                          uri += encodeURIComponent(key) + '=' + encodeURIComponent(value);
                      }
                    )
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

// Map.prototype.getDef = function (v, dv) {return this.has(v) ? this.get(v) : dv}

SVG, Util, SimpleEventHandler, Network, URLHandler, SVGMeasurements;
