const url = 'https://json-server--3000.local.webcontainer.io/comments';

fetch(url)
  .then((r) => r.json())
  .then(
    (json) =>
      (document.getElementById('output').innerHTML = JSON.stringify(
        json,
        null,
        2
      ))
  );
