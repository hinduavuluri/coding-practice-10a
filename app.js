const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
let db = null

const initializeDnAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Path: ${e.message}`)
    process.exit(1)
  }
}
initializeDnAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid jwt Token')
  } else {
    jwt.veryfy(jwtToken, 'MY_SECRET_KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(getUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (isMatch === true) {
      const payload = {username: username,};
      const jwtToken = jwt.sign(payload, 'MY_SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API2
const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ;`
  const stateList = await db.all(getStatesQuery)
  response.send(
    stateList.map((state) => convertStateDbObjectToResponseObject(state)),
  )
})

//API3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state WHERE state_id=${stateId};`
  const state = await db.get(getStateQuery)
  response.send(convertStateDbObjectToResponseObject(state))
})

//API4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES
   ('${districtName}', ${stateId}, ${cases},${cured},${active},${deaths});`
  await db.run(insertDistrictQuery)
  response.send('District Successfully Added')
})

//API5
const convertDistrictObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district WHERE district_id=${districtId};`
    const district = await db.get(getDistrictQuery)
    response.send(convertDistrictObjectToResponseObject(district))
  },
)

//API6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//API7
app.put(
  'districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE district SET district_name='${districtName}', state_id=${stateId}, 
  cases=${cases}, cured=${cured}, active=${active},
  deaths=${deaths} WHERE district_id=${districtId};`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

//API8
app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, 
  SUM(deaths) AS totalDeaths WHERE state_id=${stateId};`
    const getStateStats = await db.get(getStateStatsQuery)
    response.send(getStateStats)
  },
)

module.exports = app
