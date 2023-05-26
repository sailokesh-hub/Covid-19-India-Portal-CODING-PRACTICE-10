const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let database = null;
const initializeDbAndServer = async () => {
  try {
    database = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running at https://localhost:3000/");
    });
  } catch (error) {
    console.log(`Error in ${error}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authorizeToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username='${username}';`;
  const dbUser = await database.get(getUserQuery);
  //const hashedPassword = await bcrypt.hash(password, 10);
  if (dbUser !== undefined) {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API 2

app.get("/states/", authorizeToken, async (request, response) => {
  const userQuery = `select state_id as stateId, state_name as stateName, population from state;`;
  const dbUser = await database.all(userQuery);
  response.send(dbUser);
});

//API 3

app.get("/states/:stateId/", authorizeToken, async (request, response) => {
  const { stateId } = request.params;
  const userQuery = `select state_id as stateId, state_name as stateName, population from state where state_id=${stateId};`;
  const dbUser = await database.get(userQuery);
  response.send(dbUser);
});

//API 4
app.post("/districts/", authorizeToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createPlayerQuery = `insert into district(district_name, state_id, cases, cured, active, deaths) values('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const createPlayerQueryResponse = await database.run(createPlayerQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `select district_id as districtId, district_name as districtName, state_id as stateId, cases, cured, active, deaths from district where district_id=${districtId};`;
    const dbResponse = await database.get(deleteDistrictQuery);
    response.send(dbResponse);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id=${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `update district set district_name='${districtName}', state_id = ${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths= ${deaths};`;
    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authorizeToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district where state_id = ${stateId};`;
    const dbResponse = await database.get(getStatsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
