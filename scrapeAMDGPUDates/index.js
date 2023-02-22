(function() {
    console.clear();
    const mw_parser_output = document.querySelector("#mw-content-text .mw-parser-output");

    // split the children into sections
    const sections = [].slice.call(mw_parser_output.children).reduce((pv, cv)=>{
        // every major section starts with an h2
        if (cv.nodeName === 'H2') return pv.push([cv]), pv;
        else return pv[pv.length - 1].push(cv), pv;
    }, [[]]);

    /** @type {HTMLTableElement[]} */
    const tables = sections
    .reduce((pv, cv)=>pv.concat(cv), [])
    .filter(el=>el.nodeName === 'TABLE')
    .slice(2); // skip the first two tables, which are not graphics cards tables

    console.log(tables.length);

    const gpuList = tables
    // .reverse()
    .slice(5, 6)
    // .reverse()
    .reduce((pv, table, ix)=>{
        console.log("table:", ix);
        table = normalizeTable(table);

        // right now, I think I can check if a row contains data by checking for the presence of a td element in the last child position.
        [].slice.call(table.querySelectorAll("tbody .table-rh")).map(rh=>rh.parentElement)
        .forEach(row=>row.children[row.children.length - 1].nodeName === 'TD'
            && pv.push({
                name: walkTree(row.children[0]),
                date: walkTree(row.children[1])
            })
        );
        return pv;
    }, []);

    console.log(gpuList);

    /** @param {HTMLTableElement} table */
    function normalizeTable(table) {

        // the first row sets the number of cells
        const width = [].slice.call(table.querySelector("tr").children).reduce((pv, th)=>{
            if (th.colSpan) return pv += th.colSpan;
            else return pv += 1;
        }, 0);


        // all rows where there is a th at the beginning with class of .table-rh
        // or there is a td at the beginning
        /** @type {HTMLTableRowElement[]} */
        const rows = [].slice.call(table.querySelectorAll('tr'))
        .filter(tr=>{
            /** @type {HTMLTableRowElement} */
            const row = tr;
            if (row.children[0].classList.contains("table-rh")) return true;
            else if (row.children[0].nodeName === 'TD') return true;
            else return false;
        });

        for (let tdIndex = 0; tdIndex < width; tdIndex++) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                let rowOuter = rows[rowIndex];
                let td = rowOuter.children[tdIndex];
                if (!td) continue;
                if (td.rowSpan === 1) continue;
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
    /** @param {HTMLElement} node */
    function walkTree(node) {
        let acc = '';
        if (node.nodeName === 'BR') return ' ';
        else if (node.nodeType === Node.TEXT_NODE) acc = node.textContent;
        else for (var ix = 0; ix < node.childNodes.length; ix++) {
            let node_ = node.childNodes[ix];
            if (node_.nodeName === 'SUP') continue;
            acc += walkTree(node_);
        }
        return acc.trim();
    }
})();
