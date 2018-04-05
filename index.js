const Koa = require('koa')
const router = require('koa-router')()
const app = new Koa()
const parser = require('koa-bodyparser')()

const WebSocket = require('ws')

const IlpRedirect = require('ilp-spsp-redirect')
const WebMonetization = require('koa-web-monetization')
const monetization = new WebMonetization()
const redirect = new IlpRedirect()

const fs = require('fs-extra')
const path = require('path')
const debug = require('debug')('web-monetization-notes')
const uuid = require('uuid')
const Mustache = require('mustache')

const highlight = require('highlight.js')
const marked = require('marked')
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: ((code) => highlight.highlightAuto(code).value),
  gfm: true,
  sanitize: true,
  tables: true
})

// TODO: should the max receiver size be in the PP spec?
const MAX_RECEIVER_SIZE = 1024
const MAX_TITLE_SIZE = 255
const MAX_TEXT_SIZE = 512000
let latestNotes = []

router.get('/paid_by/:id', monetization.receiver())
router.get('/pay_to/:receiver', async ctx => {
  console.log('receiver:', ctx.params.receiver)
  ctx.set('Content-Type', 'application/spsp+json')
  ctx.body = redirect.response(ctx.params.receiver)
})

router.post('/paid_by/:id/notes', monetization.paid({ price: 100 }), async ctx => {
  console.log('ctx.request.body', ctx.request, ctx.request.body, ctx.request.text)
  const body = ctx.request.body
  const note = {
    title: body.title,
    text: body.text,
    receiver: body.receiver,
    id: uuid()
  }

  if (Buffer.byteLength(note.receiver, 'utf8') > MAX_RECEIVER_SIZE) {
    return ctx.throw(400, 'receiver is too long. max ' + MAX_RECEIVER_SIZE + ' bytes.')
  }

  if (Buffer.byteLength(note.title, 'utf8') > MAX_TITLE_SIZE) {
    return ctx.throw(400, 'title is too long. max ' + MAX_TITLE_SIZE + ' bytes.')
  }

  if (Buffer.byteLength(note.text, 'utf8') > MAX_TEXT_SIZE) {
    return ctx.throw(400, 'text is too long. max ' + MAX_TEXT_SIZE + ' bytes.')
  }

  console.log('putting note', note)
  await fs.mkdirp('./data')
  await fs.writeJson('./data/' + note.id, note)

  latestNotes.unshift(note)
  if (latestNotes.length > 10) {
    latestNotes.pop()
  }

  return ctx.redirect('/notes/' + note.id)
})

router.get('/notes/:id', async ctx => {
  try {
    const safeId = ctx.params.id.replace(/[^0-9a-f\-]/g, '')
    const note = await fs.readJson('./data/' + safeId)
    const template = await fs.readFile(path.resolve(__dirname, 'templates/notes.mustache'), 'utf8')

    ctx.set('Content-Type', 'text/html')
    ctx.body = Mustache.render(template, {
      title: note.title,
      text: marked(note.text),
      receiver: note.receiver,
      paid: Number(redirect.sent(note.receiver) / 1e6).toFixed(6) + ' XRP'
    })
  } catch (e) {
    ctx.set('Content-Type', 'text/plain')
    return ctx.throw(404, 'Note with ID "' + ctx.params.id + '" not found.')
  }
})

router.get('/client.js', async ctx => {
  ctx.set('Content-Type', 'text/javascript')
  ctx.body = await fs.readFile(path.resolve(path.dirname(require.resolve('koa-web-monetization')), 'client.js'), 'utf8')
})

router.get('/', async ctx => {
  const template = await fs.readFile(path.resolve(__dirname, 'templates/index.mustache'), 'utf8')
  ctx.set('Content-Type', 'text/html')

  const postRows = []
  for (let i = 0; i < latestNotes.length; ++i) {
    if (i % 2 === 0) postRows.push([])
    const note = latestNotes[i]
    postRows[postRows.length - 1].push({
      title: note.title,
      text: note.text.slice(0, 255) + (note.text.length > 255 ? '...' : ''),
      receiver: note.receiver,
      id: note.id
    })
  }

  ctx.body = Mustache.render(template, { postRows })
})

async function run () {
  await fs.mkdirp('./data')

  const files = await fs.readdir('./data')
  const stats = await Promise.all(files.map((f) => fs.stat(path.resolve('./data', f))))
  const statMap = files.reduce((agg, f, i) => {
    agg[f] = stats[i]
    return agg
  }, {})

  files.sort((a, b) => statMap[a].mtime < statMap[b].mtime)
  latestNotes = await Promise.all(files.slice(0, 10).map(f => fs.readJson(path.resolve('./data', f))))

  await redirect.connect()

  const server = app
    .use(parser)
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(process.env.PORT || 8080)

  const wss = new WebSocket.Server({ server })

  wss.on('connection', ws => {
    let receiver = false
    function subscribe (balance) {
      const formatted = Number(balance / 1e6).toFixed(6) + ' XRP'
      ws.send(JSON.stringify({ balance: formatted }))
    }

    function unsubscribe () {
      redirect.removeListener('receiver:' + receiver, subscribe)
    }

    ws.on('message', msg => {
      if (receiver) return
      receiver = JSON.parse(msg).receiver
      redirect.on('receiver:' + receiver, subscribe)
    })

    ws.on('close', unsubscribe)
    ws.on('error', unsubscribe)
  })
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
