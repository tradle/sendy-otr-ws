
var extend = require('xtend')
var typeforce = require('typeforce')
var WS = require('sendy-ws')
var Sendy = require('sendy')
var OTRClient = require('sendy-otr')

exports.Switchboard = function (opts) {
  typeforce({
    unreliable: 'Object',
    key: 'DSA'
  }, opts)

  return new WS.Switchboard(extend({
    identifier: opts.key.fingerprint(),
    unreliable: opts.unreliable,
    clientForRecipient: function (fingerprint) {
      return new OTRClient({
        client: new Sendy(),
        key: opts.key,
        theirFingerprint: fingerprint
      })
    }
  }, opts))
}
