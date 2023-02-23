(function() {
    console.clear();
    const mw_parser_output = document.querySelector("#mw-content-text .mw-parser-output");

    // split the children into sections
    /** @type {HTMLElement[][]} */
    let sections = [].slice.call(mw_parser_output.children).reduce((pv, cv)=>{
        // every major section starts with an h2
        if (cv.nodeName === 'H2') return pv.push([cv]), pv;
        else return pv[pv.length - 1].push(cv), pv;
    }, [[]]);

    class LabeledSection {
        /**
         * @param {string} label 
         * @param {HTMLTableElement[]} tables 
         */
        constructor(label='', tables=[]) {
            this.label = label;
            this.tables = tables;
        }
    }

    // get the section label and tables for that section
    /** @type {LabeledSection[]} */
    const labeledSections = sections.reduce((pv, cv)=>{
        let label = false;
        let tables = [];
        cv.forEach(node=>{
            if (node.nodeName === 'H3') return label = true;
            if (!label || node.nodeName !== 'TABLE') return;
            tables.push(node);
            label = false;
        });
        label = cv[0].children[0].textContent;
        pv.push(new LabeledSection(label, tables));
        return pv;
    }, []);

    // get all sections on or after Desktop GPUs
    let desktopGPUIndex = labeledSections.findIndex(section=>section.label.startsWith("Desktop GPUs"));
    if (desktopGPUIndex === -1) throw Error("Couldn't find Desktop GPUs section index");
    const gpuSections = labeledSections.slice(desktopGPUIndex);

    // reduce the sections to just the tables that I'm collecting data from
    /** @type {HTMLTableElement[]} */
    const tables = gpuSections.reduce(
        (arr, labeledSection)=>(labeledSection.tables.forEach(table=>arr.push(table)), arr),
        []
    );

    console.log("Number of tables:", tables.length);

    const gpuList = tables.slice().reduce((pv, table, ix)=>{
        // console.log("table index:", ix); debugger;
        table = normalizeTable(table);

        const body = table.querySelector('tbody');

        
        headers = body.children[0]

        const rows = [].slice.call(body.children).filter(dataRowsOnly);

        // right now, I think I can check if a row contains data by checking for the presence of a td element in the last child position.
        rows.forEach(row=>pv.push({
            name: walkTree(row.children[0]).trim().replace(/\s+/g, ' '),
            date: walkTree(row.children[1]).trim().replace(/\s+/g, ' '),
            row
        }));

        return pv;
    }, []);

    window.gpuList = gpuList;
    console.log("Matched these GPUs with date information:", gpuList);
    console.log("Following GPUs had no launch date:", gpuList.filter(gpu=>!gpu.date));

    /** @param {HTMLTableElement} table */
    function normalizeTable(table) {
        // the first row sets the number of cells
        const width = [].slice.call(table.querySelector("tr").children).reduce((pv, th)=>{
            if (th.colSpan) return pv += th.colSpan;
            else return pv += 1;
        }, 0);

        let thead = table.querySelector("thead");
        let tbody = table.querySelector("tbody");
        let tfoot = table.querySelector("tfoot");

        /** @type {HTMLTableRowElement[]} */
        let headRows = thead ? [].slice.call(thead.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let bodyRows = tbody ? [].slice.call(tbody.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let footRows = tfoot ? [].slice.call(tfoot.children) : [];
        /** @type {HTMLTableRowElement[]} */
        let rows = headRows.concat(bodyRows).concat(footRows);

        // make sure column spans are taken out
        /** @type {HTMLTableCellElement[]} */
        rows.forEach(row=>{
            /** @type {HTMLTableCellElement[]} */
            const tds = [].slice.call(row.children);
            tds.forEach(td=>{
                if (td.colSpan && td.colSpan > 1) {
                    const colSpan = td.colSpan;
                    td.removeAttribute('colspan');
                    for (let ix = 1; ix < colSpan; ix++) {
                        let td_ = td.cloneNode(true);
                        td.insertAdjacentElement("afterend", td_);
                        td = td_;
                    }
                }
            });
        })

        for (let tdIndex = 0; tdIndex < width; tdIndex++) {
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                let rowOuter = rows[rowIndex];
                let td = rowOuter.children[tdIndex];
                if (!td) continue;
                if (td.rowSpan === 1) continue;
                let rowSpan = td.rowSpan;
                td.removeAttribute('rowSpan');
                for (let offset = 1; offset < rowSpan; offset++) {
                    let rowOffset = rows[rowIndex + offset];
                    if (tdIndex === 0) rowOffset.prepend(td.cloneNode(true));
                    else rowOffset.children[tdIndex - 1].insertAdjacentElement("afterend", td.cloneNode(true));
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
        return acc;
    }
    /** @param {HTMLTableRowElement} tr */
    function dataRowsOnly(tr) {
        const row = tr;
        if (row.children[0].classList.contains("table-rh")) return true;
        else if (row.children[0].nodeName === 'TD') return true;
        else if (row.children[row.children.length - 1].nodeName === 'TD') return true;
        else if (row.querySelector('[style="text-align:left;"]')) return true;
        else if (row.querySelector('[style="text-align:left"]')) return true;
        else return false;
    }
})();
