const express = require("express");
const path = require("path");
const formidable = require("formidable");
const bodyParser = require("body-parser");
const mammoth = require("mammoth");
const fs = require("fs");

const neo4j = require("neo4j-driver");
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "shivadharma_temp_editions"));

const router = express.Router();

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

const { body, validationResult } = require("express-validator");

router.post("/addFile/:id",
    async (req, res) => {
        var idEdition = req.params.id.split("/").pop().split("-")[0];
        var idEditor = req.params.id.split("/").pop().split("-")[1];
        var form = formidable();
        form.parse(req);
        form.on("fileBegin", (name, file) => {
            file.path = `${__dirname}/../uploads/${file.name}`;
        });
        form.on("file", async (name, file) => {
            /* convert to html */
            /* docx > html */
            if (file.type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                mammoth.convertToHtml({ path: file.path })
                    .then((result) => {
                        try {
                            fs.access(file.path, fs.F_OK, () => {
                                fs.writeFile(file.path, result.value, "utf8", (err) => {
                                    if (err) {
                                        console.log("Error related to rewriting the file: " + err);
                                    } else {
                                        console.log("The file has been overwritten");
                                    };
                                });
                                fs.rename(file.path, file.path + ".html", (err) => {
                                    if (err) {
                                        console.log("Error related to renaming the file: " + err);
                                    } else {
                                        console.log("The file has been renamed: " + file.name);
                                    };
                                });
                            });
                        } catch (error) {
                            console.log("Error in converting the file: " + error);
                        };
                    })
                    .done();
            /* any format > html */
            } else {
                fs.rename(file.path, file.path + ".html", (err) => {
                    if (err) {
                        console.log("Error related to renaming the file: " + err);
                    } else {
                        console.log("The file has been renamed: " + file.name);
                    };
                });
            };
            /* post the file */
            var fileNewName = file.name + ".html";
            const session = driver.session();
            try {
                await session.writeTransaction(tx => tx
                    .run(
                        `
                        MATCH (author:Author)<-[w:WRITTEN_BY]-(work:Work)-[r:HAS_MANIFESTATION]->(edition:Edition)-[e:EDITED_BY]->(editor:Editor)
                        WHERE id(editor) = ${idEditor} AND id(editor) = ${idEditor}
                        OPTIONAL MATCH (edition)-[p:PUBLISHED_ON]->(date:Date)
                        MERGE (file:File {name: $file})
                        MERGE (file)-[pr:PRODUCED_BY]->(editor)
                        RETURN work.title, edition.title, author.name, editor.name, date.on, file.name
                        `, { file: fileNewName })
                    .subscribe({
                        onNext: record => {
                            res.render("edit", {
                                id: req.params.id,
                                work: record.get("work.title"),
                                title: record.get("edition.title"),
                                author: record.get("author.name"),
                                editor: record.get("editor.name"),
                                date: record.get("date.on"),
                                file: record.get("file.name")
                            });
                        },
                        onCompleted: () => {
                            console.log("Data added to the graph");
                        },
                        onError: err => {
                            console.log("Error related to the upload to Neo4j: " + err)
                        }
                    })
                );
            } catch (err) {
                console.log("Error related to Neo4j: " + err);
            } finally {
                await session.close();
            };
        });
        form.on("error", (err) => {
            console.log(err);
        })
        form.on("end", () => {
            console.log("File uploaded");
        });
    });

module.exports = router;