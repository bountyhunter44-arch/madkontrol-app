function loadModule(name){

const content = document.getElementById("content")

const modules = {

dashboard: `
<h2>Dashboard</h2>
<p>Oversigt over systemet</p>
`,

egenkontrol: `
<h2>Egenkontrol</h2>
<p>Daglige kontrolskemaer</p>
`,

kalkulation: `
<h2>Kalkulation</h2>
<p>Opskriftskalkulation og råvarer</p>
`,

menu: `
<h2>Menukort</h2>
<p>Opret og design menuer</p>
`,

udbringning: `
<h2>Udbringning</h2>
<p>Online bestillinger</p>
`

}

content.innerHTML = modules[name] || `<h2>Modul ikke fundet</h2>`

}