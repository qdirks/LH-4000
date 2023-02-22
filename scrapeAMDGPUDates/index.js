(function() {
    const mw_parser_output = document.querySelector("#mw-content-text .mw-parser-output");

    // split the children into sections
    const sections = [].slice.call(mw_parser_output.children).reduce((pv, cv)=>{
        // every major section starts with an h2
        if (cv.nodeName === 'H2') return pv.push([cv]), pv;
        else return pv[pv.length - 1].push(cv), pv;
    }, [[]]);

    /** @type {HTMLTableElement[]} */
    const tables = sections.find(section=>section[0].textContent.startsWith("Desktop GPUs"))
    .filter(el=>el.nodeName === 'TABLE');

    // let's try going through the tables backwards so that we start with the latest cards

    // last 10 for nvidia
    // last 10 for amd

    console.log(tables.length);

    const gpuList = tables.reverse().slice(0, 26).reverse().reduce((pv, table)=>{

        table = normalizeTable(table);

        // right now, I think I can check if a row contains data by checking for the presence of a td element in the last child position.
        function walkTree(node) {
            if (node.nodeName === 'BR') return ' ';
            else if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            else for (var ix = 0, acc = ''; ix < node.childNodes.length; ix++) {
                let node_ = node.childNodes[ix];
                if (node_.nodeName === 'SUP') continue;
                acc += walkTree(node_);
            }
            return acc;
        }
        [].slice.call(table.querySelectorAll("tbody tr")).forEach(row=>{
            if (row.children[row.children.length - 1].nodeName !== 'TD') return; // skip non data row
            const gpu = {
                name: walkTree(row.children[0]).trim(),
                date: walkTree(row.children[1]).trim()
            };
            pv.push(gpu);
        });
        return pv;
    }, []);

    console.log(gpuList);

    /** @param {HTMLTableElement} table */
    function normalizeTable(table) {
        // make a copy
        // table = table.cloneNode(true);

        // take out the row span crap
        /** @type {HTMLTableRowElement[]} */
        let rows = [].slice.call(table.querySelectorAll("tbody tr"));

        // the first row sets the number of cells
        const width = [].slice.call(rows[0].children).reduce((pv, th)=>{
            if (th.colSpan) return pv += th.colSpan;
            else return pv += 1;
        }, 0);

        rows = rows.filter(row=>row.children[row.children.length - 1].nodeName === 'TD');

        for (let tdIndex = 0; tdIndex < width; tdIndex++) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                let rowOuter = rows[rowIndex];
                let td = rowOuter.children[tdIndex];
                if (!td) continue;
                if (!td.rowSpan) continue;
                let rowSpan = td.rowSpan;
                td.removeAttribute('rowSpan');
                for (let ix = 1; ix < rowSpan; ix++) {
                    let rowInner = rows[rowIndex + ix];
                    if (tdIndex === 0) rowInner.prepend(td.cloneNode(true));
                    else rowInner.children[tdIndex - 1].insertAdjacentElement("afterend", td.cloneNode(true));
                }
                rowIndex = rowIndex + rowSpan - 1;
            }
        }


        return table;
    }
})();
