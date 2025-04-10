# schwab-dashboard-react

## A stock market dashboard using the streaming class from schwab-client-js

### **schwab-client-js** gives you complete access to the Schwab REST API using convenient classes and methods. You can stream real-time market data, create and track orders, and retrieve information about your account as well as retrieve different types of market data.

## Installation

**Software prerequisites: nodejs version 18 or newer and a package manager like npm or yarn**

```
npm install

or

yarn
```

You'll need to create the `.env` file as described in the schwab-client-js instructions.
If you don't have a working SCHWAB_REFRESH_TOKEN, you can run `schwab-authorize` to create one.
See the schwab-client-js instructions.

## Usage

```
yarn dev

or

npm run dev
```

Those commands will try to open the frontend in your default web browser and launch the
server running nodejs. If you see some kind of `can't connect` message in your web browser,
try refreshing your web browser (sometimes the frontend launches before the backend is ready).
The dashboard uses SSE (Server-Sent Events) to send the
data from the server to the web browser.

[Note: For situtations where using a ```.env```file or environment variables may not be optimal (possibly AWS Lambda, for example), schwab-client-js also supports injecting your security tokens directly e.g. ```const mktclient = new MarketApiClient(appKey,appSecret,appRefresh);```]

1. Create a `.env` file at the root of your project and add the App Key and Secret from your app on developer.schwab.com. Optionally, you can add your callback URL to your .env file like this (for details on creating your `SCHWAB_CALLBACK_URL`, see the [Schwab API Configuration doc](docs/SchwabConfig.md)):

```
SCHWAB_CALLBACK_URL=https://127.0.0.1:5556
SCHWAB_APP_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCHWAB_SECRET=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
```
USE THIS TO AUTH
https://github.com/JonM100/schwab-client-js/edit/main/docs/SchwabConfig.md#schwab-authorizejs-and-manual-authorizejs


If you don't specify a `SCHWAB_CALLBACK_URL`, I will assume a default value of `https://127.0.0.1:5556`

2. Creating a `SCHWAB_REFRESH_TOKEN`. Run `schwab-authorize` OR `manual-authorize` to help you create the `SCHWAB_REFRESH_TOKEN`. You should be able to run `schwab-authorize` from the root of your project (on MacOS and Linux) by merely typing `schwab-authorize` . On Windows, you'll likely have to run it with node and specify the full path:
   `C:\> node node_modules/schwab-client-js/bin/schwab-authorize.js`
   Same with `manual-authorize`. The script `manual-authorize` is for users who would rather not deal with the self-signed SSL certificate that `schwab-authorize` generates.

See the [Schwab API Configuration doc](docs/SchwabConfig.md) for details about `schwab-authorize` and `manual-authorize`.

3. Your `.env` file should now look like this (as previously mentioned, the `SCHWAB_CALLBACK_URL` is optional and will default to `https://127.0.0.1:5556` if not provided):

```
SCHWAB_CALLBACK_URL=https://127.0.0.1:5556
SCHWAB_APP_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SCHWAB_SECRET=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
SCHWAB_REFRESH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

## **Congratulations! You are now ready to make API calls.**

## MIT License

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
# ReactSchwabDash
