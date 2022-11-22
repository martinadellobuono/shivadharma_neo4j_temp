const express = require("express");
const bodyParser = require("body-parser");

const neo4j = require("neo4j-driver");
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "shivadharma_temp_editions"));

const router = express.Router();

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

router.post("/getstarted",
    async (req, res) => {
        /* post data */
        const session = driver.session();
        try {
            await session.writeTransaction(tx => tx
                .run("MERGE (work:Work {title: $work}) MERGE (edition:Edition {title: $title}) MERGE (author:Author {name: $author}) MERGE (editor:Editor {name: $editor}) MERGE (work)-[h:HAS_MANIFESTATION]->(edition) MERGE (work)-[w:WRITTEN_BY]->(author) MERGE (edition)-[e:EDITED_BY]->(editor) RETURN work.title, ID(edition), edition.title, author.name, ID(editor), editor.name", { work: req.body.work, title: req.body.title, author: req.body.author, editor: req.body.editor })
                .subscribe({
                    onNext: record => {
                        res.redirect("edit/" + record.get("ID(edition)") + "-" + record.get("ID(editor)"));
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
    }
);

module.exports = router;