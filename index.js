const Koa = require('koa')
const router = require('koa-router')()
const app = new Koa()
const parser = require('koa-bodyparser')()

const WebMonetization = require('koa-web-monetization')
const monetization = new WebMonetization()

const fs = require('fs-extra')
const path = require('path')
const debug = require('debug')('web-monetization-notes')
const uuid = require('uuid')
const Mustache = require('mustache')

// TODO: should the max receiver size be in the PP spec?
const MAX_RECEIVER_SIZE = 1024
const MAX_TITLE_SIZE = 255
const MAX_TEXT_SIZE = 512000

router.get('/paid_by/:id', monetization.receiver())

router.post('/paid_by/:id/notes', /* monetization.paid({ price: 100 }) ,*/ async ctx => {
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
  await fs.writeJson('./data/' + note.id + '.txt', note)

  return ctx.redirect('/notes/' + note.id)
})

router.get('/notes/:id', async ctx => {
  try {
    const safeId = ctx.params.id.replace(/[^0-9a-f\-]/g, '')
    const note = await fs.readJson('./data/' + safeId + '.txt')
    const template = await fs.readFile(path.resolve(__dirname, 'templates/notes.mustache'), 'utf8')

    ctx.set('Content-Type', 'text/html')
    ctx.body = Mustache.render(template, note)
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
  ctx.body = Mustache.render(template, {})
})

app
  .use(parser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(process.env.PORT || 8080)
