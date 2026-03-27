import express from "express";

const app = new express();

app.use("/aluminum/", express.static("/media/abby/files/Documents/github/arrowjs-aluminum/docs"));
app.get("*a", (req, res) =>
    res.sendFile("/media/abby/files/Documents/github/arrowjs-aluminum/docs/404.html"));

app.listen(4000);
