const { google } = require('googleapis');
const moment = require('moment');
const readline = require('readline');
let fs = require('fs')
// require('dotenv').config

const startDate = moment().format('YYYY/MM/DD');

const endDate = moment().add(7, 'days').format('YYYY/MM/DD');
//console.log(startDate,endDate)
//creating the response that has to be sent 
const responsermsg = `Hi there,

Thank you for your email! I am currently out of the office and will not be checking my email until ${endDate}. I will respond to your message as soon as possible when I return.

Best regards,
Lord Yoda`;
//configuring credentials required 
//we could pass the cred value via env file
const credentials = {
  client_id: ['clientid'],
  client_secret: 'clientSecret',
  redirect_uris: ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'],
};

//instance of Oauth
const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0],
);

//login with google functonality
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.labels', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.compose'],
});
console.log(`Please authorize this app by visiting this URL:\n${authUrl}\n`);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question('Enter the code from that page here: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  fs.writeFileSync('tokens.json', JSON.stringify(tokens));
  console.log('Token stored to tokens.json');
  rl.close();
  autoresponder(tokens);
});

//vacation email responder
async function autoresponder(tokens) {
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      name: 'AWAY',//label for the vacationemails
    },
  });
  const labelId = res.data.id;

  
  let messages = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${startDate} before:${endDate}`,
    auth: oauth2Client,
  });

  //moving all the vacation emails to the label
  for (let message of messages.data.messages) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: message.id,
      requestBody: {
        addLabelIds: [labelId],
      },
      auth: oauth2Client,
    });
    //setting the headers retrieved and adding header values 
  let ress = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format:'metadata',
      metadataHeaders: ['Subject','From'],
  })
  //we get the data i.e the message metaheaders from the above function and then we add required fields
  let sub = ress.data.payload.headers.find(
      (header) => header.name === 'Subject'
  ).value;
  let from = ress.data.payload.headers.find(
      (header) => header.name === 'From'
  ).value;
  //retrieving the receipients id 
  let to = from.match(/<(.*)>/)[1];
  let tosub = sub.startsWith('Re:') ? sub:`vacation: ${sub}`;
  //finally sending the emails to the respective receipients under the label
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(`To: ${to}\nSubject: Re: ${tosub}\n\n${responsermsg}\n`).toString('base64'),
      },
      auth: oauth2Client,
    });
  }

}