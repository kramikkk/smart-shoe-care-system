import { createServer } from 'http'
import next from 'next'
import { createWebSocketServer } from './src/lib/websocket'

const dev = process.env.NODE_ENV !== 'production'

const hostname = 'localhost'
const listenHost = '0.0.0.0' // Listen on all interfaces for LAN access
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize WebSocket server
  createWebSocketServer(server)

  server.listen(port, listenHost, () => {
    // Show both localhost and LAN URLs
    const os = require('os')
    const ifaces = os.networkInterfaces()
    const lanIps = Object.values(ifaces)
      .flat()
      .filter((iface): iface is { family: string; internal: boolean; address: string } =>
        typeof iface === 'object' && iface !== null &&
        'family' in iface && iface.family === 'IPv4' &&
        'internal' in iface && !iface.internal &&
        'address' in iface && typeof iface.address === 'string'
      )
      .map((iface) => iface.address)
    console.log(`> Ready on:`)
    console.log(`   Local:    http://${hostname}:${port}`)
    lanIps.forEach(ip => {
      console.log(`   Network:  http://${ip}:${port}`)
    })
    console.log(`> WebSocket server running on:`)
    console.log(`   ws://localhost:${port}/api/ws`)
    lanIps.forEach(ip => {
      console.log(`   ws://${ip}:${port}/api/ws`)
    })
  })
})
