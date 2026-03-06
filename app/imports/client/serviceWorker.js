Meteor.startup(() => {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('/sw.js')
    .then()
    .catch(error => console.log('ServiceWorker registration failed: ', error));
});
