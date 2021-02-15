const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
app.use(express.json());
app.use(
	session({
		secret: "session_secret",
	})
);

//CREATING CONNECTION WITH THE DATABASE

const db = mongoose.createConnection("mongodb://localhost:27017/Online_Rent", {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
db.on("connected", () => {
	console.log("connected to database.");
});

//DEFINING THE SCHEMAS
const userSchema = new mongoose.Schema({
	userName: String,
	password: String,
});
const itemSchema = new mongoose.Schema({
	name: String, //name of item
	rent_price: Number,
	mDate: Number, //manufacturing date in format DDMMYY
	actual_cost: Number,
	rent: Boolean, // is on rent or not
	userId: mongoose.Schema.Types.ObjectId, // stores the object id of the user who posted the item
});
const userModel = db.model("user", userSchema);
const itemModel = db.model("item", itemSchema);

// function to check null or undefined
const nullOrUnd = (val) => val === null || val === undefined;

// API ENDPOINTS
// SIGNUP
app.post("/signup", async (req, res) => {
	const { userName, password } = req.body;
	// in the model find a user with same name
	const existingUser = await userModel.findOne({ userName });
	// null or undefined means not found
	if (nullOrUnd(existingUser)) {
		// we can create a new user
		const hashedPw = bcrypt.hashSync(password, salt);
		const newUser = new userModel({ userName, password: hashedPw });
		await newUser.save();
		req.session.userId = newUser._id;
		// storing the current user id in session
		// storing it in during login or signup
		res.status(201).send({ success: "Signed up" });
	} else {
		res.status(401).send({ error: "Username already exists" });
	}
});

//LOGIN
app.post("/login", async (req, res) => {
	const { userName, password } = req.body;
	const existingUser = await userModel.findOne({ userName });
	if (nullOrUnd(existingUser)) {
		res.status(404).send({ error: "Username not found" });
	} else {
		const hashedPw = existingUser.password;
		if (bcrypt.compareSync(password, hashedPw)) {
			req.session.userId = existingUser._id;
			res.status(201).send({ success: "Signed in" });
		} else {
			res.status(401).send({ error: "Password incorrect" });
		}
	}
});

// authentication middleware
const authMw = async (req, res, next) => {
	if (nullOrUnd(req.session) || nullOrUnd(req.session.userId)) {
		res.status(401).send({ error: "Not logged in" });
	} else {
		next();
	}
};

// get all items listed by a user
app.get("/item", authMw, async (req, res) => {
	//finding all todos where the userId is same as the current userId (or the logged in user)
	const allItems = await itemModel.find({ userId: req.session.userId });
	res.status(201).send(allItems);
});

// post a new item
app.post("/item", authMw, async (req, res) => {
	//req.body will only have the properties name, manufacturing date, rent price, actual cost
	//we have to add the remaining properties like rent and userId
	const item = req.body;
	item.rent = false;
	item.userId = req.session.userId;
	//this userId is used to filter the items (search all items with this userId and display)
	const newItem = new itemModel(item);
	await newItem.save(); // save in the database
	res.status(201).send(newItem);
});

//PUT - edit an existing item
app.put("/item/:itemId", authMw, async (req, res) => {
	//directly storing the item from req.body obj in task (Destructuring)
	const { name, rent_price, mDate, actual_cost } = req.body;
	const itemId = req.params.itemId; //objectId of the task that needs to be edited
	try {
		//finding the exact item that is being referred to
		//needs to have same itemId as the query param
		// also needs to have same userId as contained in the current session
		const existingItem = await itemModel.findOne({
			userId: req.session.userId,
			_id: itemId,
		});
		//if no such item exists
		if (nullOrUnd(existingTodo)) {
			res.sendStatus(404);
		} else {
			//check if it is already on rent
			if (existingItem.rent === false) {
				//update
				existingItem.name = name;
				existingItem.rent_price = rent_price;
				existingItem.mDate = mDate;
				existingItem.actual_cost = actual_cost;
				await existingItem.save();
				res.status(201).send(existingItem);
			} else {
				res
					.status(401)
					.send({ error: "Item is on rent. Try again when it's free." });
			}
		}
	} catch (e) {
		//searching elements  by _id may return exceptions that can only be caught by catch
		res.sendStatus(401);
	}
});

// delete an item
app.delete("/item/:itemId", authMw, async (req, res) => {
	//This api is very much similar to the edit api
	const itemId = req.params.itemId;
	const existingItem = await itemModel.findOne({
		userId: req.session.userId,
		_id: itemId,
	});
	if (nullOrUnd(existingTodo)) {
		res.sendStatus(404);
	} else {
		if (existingItem.rent === false) {
			await itemModel.deleteOne({ userId: req.session.userId, _id: itemId });
			res.sendStatus(200);
		} else {
			res
				.status(401)
				.send({ error: "Item is on rent. Try again when it's free." });
		}
	}
});

// User logout
app.get("/logout", (req, res) => {
	if (!nullOrUnd(req.session)) {
		//destroying the session will automatically bring us back to the sign-in/sign-up page
		req.session.destroy(() => {
			res.sendStatus(200);
		});
	} else {
		//it's alright if the session doesn't exist. It means we're already logged out
		res.sendStatus(200);
	}
});

//getting the name of the current user
app.get("/userinfo", authMw, async (req, res) => {
	//as req.session.userId can never be manipulated it means that the id will never be invalid
	//So we can omit using try-catch block
	const user = await userModel.findById(req.session.userId);
	res.send({ userName: user.userName });
});

//App listens on port 8080
app.listen(8080, () => {
	console.log("app listening on port 8080");
});
