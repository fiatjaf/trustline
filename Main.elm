import Html exposing
  ( Html, text
  , div
  , input, button
  )
import Html.Events exposing (onInput, onClick)
import Html.Attributes exposing (placeholder)
import Dict exposing (Dict)
import Maybe.Extra exposing ((?))

import Ports exposing (..)
import Trustline exposing (..)

main =
  Html.program
    { init = init
    , view = view
    , update = update
    , subscriptions = subscriptions
    }


-- MODEL


type alias Model =
  { id : String
  , trustlines : Dict String Trustline
  , typing_value : String
  , selected_currency : String
  , default_currency : String
  }

init : (Model, Cmd Msg)
init =
  ( { id = ""
    , trustlines = Dict.empty
    , typing_value = ""
    , selected_currency = "USD"
    , default_currency = "USD"
    }
  , Cmd.none
  )


-- UPDATE


type Msg
  = GotMyself String
  | GotConnection String
  | GotBlock (String, Block)
  | IssueIOU String
  | ChangeAmount String

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    GotMyself id -> ( { model | id = id }, Cmd.none )
    GotConnection to ->
      ( { model
          | trustlines = model.trustlines
            |> Dict.insert to (Trustline to [])
        }
      , Cmd.none
      )
    GotBlock (from, block) ->
      ( { model
          | trustlines = model.trustlines
            |> Dict.update from (Maybe.map <| appendBlock block)
        }
      , Cmd.none
      )
    IssueIOU to ->
      ( { model | typing_value = "", selected_currency = model.default_currency }
      , issueIOU (to, model.typing_value, model.selected_currency)
      )
    ChangeAmount amt ->
      ( { model | typing_value = amt }, Cmd.none )


-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.batch
    [ gotBlock GotBlock
    , gotConnection GotConnection
    , gotMyself GotMyself
    ]


-- VIEW


view : Model -> Html Msg
view model =
  div []
    [ text model.id
    , div []
      <| List.map viewChat
      <| Dict.toList model.trustlines
    ]

viewChat : (String, Trustline) -> Html Msg
viewChat (id, {chain}) =
  div []
    [ text id
    , div []
      [ text "issue IOU"
      , input [ onInput ChangeAmount, placeholder "amount" ] []
      , button [ onClick (IssueIOU id) ] [ text "issue" ]
      ]
    , div []
      <| List.map (div [] << List.singleton << text << toString)
      <| chain
    ]
