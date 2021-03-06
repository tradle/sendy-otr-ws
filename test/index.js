
var path = require('path')
var test = require('tape')
var WSClient = require('sendy-ws')
var WebSocketRelay = require('sendy-ws-relay')
var Connection = require('sendy').Connection
var DSA = require('@tradle/otr').DSA
var KEYS = require('./fixtures/keys')
var strings = require('./fixtures/strings')
var Switchboard = require('../').Switchboard
var port = 32234

test('websockets with relay', function (t) {
  console.log('this tests recovery when more than half the packets\n' +
    'are dropped so give it a minute to complete')

  var relayPath = '/custom/relay/path'
  var relay = new WebSocketRelay({
    port: port,
    path: relayPath
  })

  var receive = Connection.prototype.receive
  Connection.prototype.receive = function () {
    // drop messages randomly
    if (Math.random() < 0.4) {
      return receive.apply(this, arguments)
    }
  }

  var relayURL = 'http://127.0.0.1:' + port + path.join('/', relayPath)
  var names = ['bill', 'ted', 'rufus']
  var keys = names.map(function (name, i) {
    return DSA.parsePrivate(KEYS[i])
  })

  var state = {}

  var togo = names.length * (names.length - 1) * 2
  var numReceived = 0
  var numSent = 0
  var sIdx = 0

  names.forEach(function (me, i) {
    var networkClient = new WSClient({
      url: relayURL + '?from=' + me,
      autoConnect: true
    })

    var myState = state[me] = {
      client: new Switchboard({
        key: keys[i],
        unreliable: networkClient,
        identifier: me
      }),
      sent: {},
      received: {},
      networkClient: networkClient
    }

    // ;['connect', 'disconnect'].forEach(function (e) {
    //   myState.client._uclient.on(e, function () {
    //     console.log(me, e + 'ed')
    //   })
    // })

    myState.client.on('message', function (msg, from) {
      // console.log('from', from, 'to', me)
      msg = JSON.parse(msg)
      numReceived++
      t.notOk(myState.received[from]) // shouldn't have received this yet
      t.equal(msg.dear, me) // should be addressed to me
      myState.received[from] = true
      done()
    })

    names.forEach(function (them) {
      if (me === them) return

      myState.client.send(them, toBuffer({
        dear: them,
        contents: strings[sIdx++ % strings.length]
      }), function () {
        // console.log('delivered from', me, 'to', them)
        t.notOk(myState.sent[them])
        myState.sent[them] = true
        numSent++
        done()
      })
    })
  })

  // setInterval(function () {
  //   // randomly drop connections
  //   var idx1 = Math.random() * names.length | 0
  //   var name = names[idx1]
  //   // console.log('randomly disconnecting ' + name)
  //   state[name].networkClient._socket.disconnect()
  // }, 1000).unref()

  function done () {
    if (--togo) return

    var x = names.length * (names.length - 1)
    t.equal(numReceived, x)
    t.equal(numSent, x)
    Connection.prototype.receive = receive

    for (var me in state) {
      state[me].client.destroy()
    }

    t.end()
    // Socket.IO takes ~30 seconds to clean up (timeout its connections)
    // no one wants to wait that long for tests to finish
    process.exit(0)
  }
})

function toBuffer (obj) {
  return new Buffer(JSON.stringify(obj))
}
