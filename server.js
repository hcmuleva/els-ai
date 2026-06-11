import express from "express";

const app = express();
const port = 3000;

app.use(express.json());

const users = [{ id: 1, name: "John Doe", email: "john.doe@example.com" }];

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", (req, res) => {
  const { name, email } = req.body;  
  const newUser = { id: users.length + 1, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  const user = users.find((u) => u.id === parseInt(id));
  if (user) {
    user.email = email;
    res.json(user);
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
