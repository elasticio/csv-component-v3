[![CircleCI](https://circleci.com/gh/elasticio/csv-component.svg?style=svg)](https://circleci.com/gh/elasticio/csv-component)
# CSV Component

## Table of Contents
* [Description](#description)
* [How works](#how-works)
* [Requirements](#requirements)
* [Environment variables](#environment-variables)
* [Credentials](#credentials)
* [Actions](#actions)
  * [Read CSV attachment](#read-CSV-attachment)
  * [Create CSV From Message Stream](#create-CSV-from-message-stream)
  * [Create CSV From JSON Array](#create-CSV-from-JSON-array)
* [Limitations](#limitations)

## Description

A component to read and write Comma Separated Values (CSV) files.

## How works

The component can read the CSV file from a remote URL or from the message
attachment. It can also write a CSV file from the incoming events.

## Requirements

## Environment variables
Name|Mandatory|Description|Values|
|----|---------|-----------|------|
|EIO_REQUIRED_RAM_MB| false | Value of allocated memory to component | Recommended: `512`/`1024` |
|REQUEST_TIMEOUT| false |  HTTP request timeout in milliseconds | Default value: `10000` |
|REQUEST_RETRY_DELAY| false | Delay between retry attempts in milliseconds | Default value: `7000` |
|REQUEST_MAX_RETRY| false | Number of HTTP request retry attempts |  Default value: `7` |
|REQUEST_MAX_CONTENT_LENGTH| false | Max size of http request in bytes | Default value: `10485760` |
|TIMEOUT_BETWEEN_EVENTS| false | Number of milliseconds write action wait before creating separate attachments | Default value: `10000` |


## Credentials

The component does not require credentials to function.

## Actions

### Read CSV attachment

This action will read the CSV attachment of the incoming message or from the specified URL and output a JSON object.
To configure this action the following fields can be used:

#### Config Fields

* `Emit Behavior` (dropdown, required) - this selector configures output behavior of the component. 
  * `Fetch All` - the component emits an array of messages;
  * `Emit Individually` - the component emits a message per row;
  * `Emit Batch` - component will produce a series of message where each message has an array of max length equal to the `Batch Size`;
* `Skip empty lines` (checkbox, optional) - by default, empty lines are parsed if checked they will be skipped
* `Comment char` (string, optional) - if specified, skips lines starting with this string

#### Input Metadata

*   `URL` - We will fetch this URL and parse it as CSV file
*   `Contains headers` - if true, the first row of parsed data will be interpreted as field names, false by default.
*   `Delimiter` - The delimiting character. Leave blank to auto-detect from a list of most common delimiters or provide your own
     <details><summary>Example</summary>
     if you use "$" as Delimiter, this CSV:

    ```
    a$b$c$d
    ```

    can be parsed into this JSON

    ``` json
    {
     "column0": "a",
     "column1": "b",
     "column2": "c",
     "column3": "d"
    }
    ```
    </details>
*   `Convert Data types` - numeric data and boolean data will be converted to their type instead of remaining strings, false by default.
If `Emit Behavior` equals to `Emit Batch` - new field appears: `Batch Size` - max length of array for each message

#### Output Metadata
- For `Fetch page` and `Emit Batch`: An object with key ***result*** that has an array as its value
- For `Emit Individually`:  Each object fill the entire message

#### Limitations
* If you use `Fetch All` then component needs to store whole file and object in memory that cause big memory usage
* In `Emit Batch` use wisely `Batch Size`, bigger number cause bigger memory usage
* Possible exception: `[ERR_STREAM_PREMATURE_CLOSE]` could be thrown when flow stopped before finish emiting all data in file, as stream stopped

### Create CSV From Message Stream

This action will combine multiple incoming events into a CSV file until there is a gap
of more than 10 seconds between events. Afterwards, the CSV file will be closed
and attached to the outgoing message.

#### Config Fields

* `Upload CSV as file to attachments` (checkbox, optional) -  If checked store the generated CSV data as an attachment. If unchecked, place the CSV as a string in the outbound message.
* `Separator` (string, optional) - A single char used to delimit the CSV file. Default to "`,`" but you can set any
     <details><summary>Example</summary>
     if you use "$" as Delimiter, this CSV:

    ```
    a$b$c$d
    ```

    can be parsed into this JSON

    ``` json
    {
     "column0": "a",
     "column1": "b",
     "column2": "c",
     "column3": "d"
    }
    ```
    </details>
* `Column Order` (string, optional) - A string delimited with the separator indicating which columns & in what order the columns should appear in the resulting file. If omitted, the column order in the resulting file will not be deterministic. Columns names will be trimmed (removed spaces in beginning and end of column name, for example: 'col 1,col 2 ,col 3, col 4' => ['col 1', 'col 2', 'col 3', 'col 4'])
* `New line delimiter` (string, optional, defaults to `\r\n`) - The character used to determine newline sequence. 
* `Escape formulae` (checkbox, optional) - If checked, field values that begin with `=`, `+`, `-`, `@`, `\t`, or `\r`, will be prepended with a ` ` ` to defend against injection attacks, because Excel and LibreOffice will automatically parse such cells as formulae

#### Input Metadata

* `Include Headers` - Indicates if a header row should be included in the generated file.
* `Input Object` - Object to be written as a row in the CSV file. If the Column Order is specified, then individual properties can be specified.

#### Output Metadata

* If **Upload CSV as file to attachments** is checked:
  * `csvString` - The output CSV as a string inline in the body

* If **Upload CSV as file to attachments** is not checked:
  * `attachmentUrl` - A URL to the CSV output
  * `type` - Always set to `.csv`
  * `size` - Size in bytes of the resulting CSV file
  * `attachmentCreationTime` - When the attachment was generated
  * `attachmentExpiryTime` - When the attachment is set to expire
  * `contentType` - Always set to `text/csv`

### Create CSV From JSON Array

This action will convert an incoming array into a CSV file

#### Config Fields

* `Upload CSV as file to attachments` (checkbox, optional) -  If checked store the generated CSV data as an attachment. If unchecked, place the CSV as a string in the outbound message.
* `Separator` (string, optional) - A single char used to delimit the CSV file. Default to "`,`" but you can set any
     <details><summary>Example </summary>
     default:

    ```
    a,b,c,d
    ```

    using "`;`" as separator:

    ```
    a;b;c;d
    ```
    </details>
* `Column Order` (string, optional) - A string delimited with the separator indicating which columns & in what order the columns should appear in the resulting file. If omitted, the column order in the resulting file will not be deterministic. Columns names will be trimmed (removed spaces in beginning and end of column name, for example: 'col 1,col 2 ,col 3, col 4' => ['col 1', 'col 2', 'col 3', 'col 4'])
* `New line delimiter` (string, optional, defaults to `\r\n`) - The character used to determine newline sequence. 
* `Escape formulae` (checkbox, optional) - If checked, field values that begin with `=`, `+`, `-`, `@`, `\t`, or `\r`, will be prepended with a ` ` ` to defend against injection attacks, because Excel and LibreOffice will automatically parse such cells as formulae

#### Input Metadata

* `Include Headers` - Indicates if a header row should be included in the generated file.
* `Input Array` - Array of objects to be written as rows in the CSV file. (One row per object + headers) If the Column Order is specified, then individual properties can be specified. The component will throw an error when the array is empty.

#### Output Metadata

* If **Upload CSV as file to attachments** is checked:
  * `csvString` - The output CSV as a string inline in the body

* If **Upload CSV as file to attachments** is not checked:
  * `attachmentUrl` - A URL to the CSV output
  * `type` - Always set to `.csv`
  * `size` - Size in bytes of the resulting CSV file
  * `attachmentCreationTime` - When the attachment was generated
  * `attachmentExpiryTime` - When the attachment is set to expire
  * `contentType` - Always set to `text/csv`

## Limitations

### General

* You may get `Component run out of memory and terminated.` error during run-time, that means that component needs more memory, please add
 `EIO_REQUIRED_RAM_MB` environment variable with an appropriate value (e.g. value `1024` means that 1024 MB will be allocated) for the component in this case.
* Maximal possible size for an attachment is 10 MB.
* Attachments mechanism does not work with [Local Agent Installation](https://docs.elastic.io/getting-started/local-agent.html)
* Inbound message in `Message Stream` and each element of `JSON Array` should be a plain Object, if value not a primitive type it will be set as `[object Object]`