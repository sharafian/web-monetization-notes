const Koa = require('koa')
const router = require('koa-router')()
const parser = require('koa-bodyparser')()
const app = new Koa()

const WebMonetization = require('koa-web-monetization')
const monetization = new WebMonetization()

const fs = require('fs-extra')
const debug = require('debug')('web-monetization-notes')
const uuid = require('uuid')

// TODO: should the max receiver size be in the PP spec?
const MAX_RECEIVER_SIZE = 1024
const MAX_TITLE_SIZE = 255
const MAX_TEXT_SIZE = 512000

router.post('/notes', monetization.paid({ price: 100 }), async ctx => {
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

  await fs.mkdirp('./data')
  await fs.writeJson('./data/' + note.id + '.txt', note)

  ctx.body = note
})

router.get('/notes/:id', async ctx => {
  try {
    const safeId = ctx.params.id.replace(/[^0-9a-f\-]/g, '')
    const note = await fs.readJson('./data/' + safeId + '.txt')

  } catch (e) {
    ctx.set('Content-Type', 'text/plain')
    return ctx.throw(404, 'Note with ID "' + ctx.params.id + '" not found.')
  }
})

router.get('/', async ctx => {

})
