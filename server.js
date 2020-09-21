const express = require('express')
const mongoose = require('mongoose')
const redis = require('redis')

const app = express()
app.use(express.json())

const connectDB = async () => {
  const conn = await mongoose.connect('mongodb://localhost/redis-test', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  console.log(`MongoDB Connected: ${conn.connection.host}`)
}

connectDB()

app.listen(3000, () => {
  console.log('Server running on port 3000')
})

const redisClient = redis.createClient('redis://localhost')
redisClient.on('error', e => {
  console.log(e)
})

const NoteSchema = new mongoose.Schema({
  title: String,
  note: String,
})

const Note = mongoose.model('Note', NoteSchema)

app.post('/api/notes', async (req, res) => {
  const { title, note } = req.body

  const _note = new Note({
    title,
    note,
  })
  try {
    const newNote = await _note.save()
    redisClient.setex(
      newNote._id.toString(),
      60,
      JSON.stringify(newNote),
      (err, reply) => {
        if (err) {
          console.error(err)
	  return res.status(500).send()
        }
        console.log(reply)
      }
    )
    return res.status(201).json({
      message: 'note saved',
      note: newNote,
    })
  } catch (e) {
    res.status(500).send()
  }
})

// cache middleware
const isCached = (req, res, next) => {
  const { id } = req.params
  redisClient.get(id, (err, data) => {
    if (err) console.error(err)
    if (data) {
      console.log('from cache')
      const response = JSON.parse(data)
      return res.status(200).json(response)
    }
    next()
  })
}

app.get('/api/notes/:id', isCached, async (req, res) => {
  const { id } = req.params
  try {
    const note = await Note.findById(id)
    return res.status(200).json({ note })
  } catch (e) {
    return res.status(404).json(e)
  }
})
