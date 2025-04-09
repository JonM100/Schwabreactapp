# schwab-dashboard-react

## A stock market dashboard using the streaming class from schwab-client-js

<figure>
     <img src="public/stockdashboard.png" alt="Description" width="800">
     <figcaption>schwab-dashboard-react</figcaption>
</figure>

## This dashboard uses React and reCharts to stream real-time market data from Schwab and display it in your web browser

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

## MIT License

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
# ReactSchwabDash
