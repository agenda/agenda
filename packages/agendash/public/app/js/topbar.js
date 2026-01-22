const topbar = Vue.component("topbar", {
  props: ["name", "state", "search", "property"],
  data: () => ({
    limit: 50,
    skip: 0,
    refresh: 30,
    object: false,
    stateobject: [
      { text: "All", value: "", class: "" },
      { text: "Scheduled", value: "scheduled", class: "" },
      { text: "Queued", value: "queued", class: "text-primary" },
      { text: "Running", value: "running", class: "text-warning" },
      { text: "Completed", value: "completed", class: "text-success" },
      { text: "Failed", value: "failed", class: "text-danger" },
      { text: "Repeating", value: "repeating", class: "text-info" },
    ],
  }),
  methods: {
    submit() {
      this.$emit(
        "search-form",
        this.name,
        this.search,
        this.property,
        this.limit,
        this.skip,
        this.refresh,
        this.state,
        this.object
      );
    },
  },
  template: `
  <form @submit.prevent="submit">
    <div class="row">
      <div class="col-xs-12 col-md-6">
          <div class="input-group mt-2 mb-2">
            <div class="input-group-prepend">
              <span class="input-group-text"> Name </span>
            </div>
            <input type="text" class="form-control" placeholder="job name" v-model='name'/>
          </div>
          <div class="input-group mt-2 mb-2">
            <div class="input-group-prepend">
              <span class="input-group-text"> Property </span>
            </div>
            <input type="text" class="form-control" placeholder="data.color" v-model="property" />
          </div>
          <div class="input-group mt-2 mb-2">
            <div class="input-group-prepend">
              <span class="input-group-text"> Value </span>
            </div>
            <input class="form-control" v-model="search" placeholder="green"/>
            <div class="form-check mx-2 pt-2">
                <input type="checkbox" v-model="object" class="form-check-input" id="isObjectId">
                <label class="form-check-label" for="isObjectId"> Is ObjectId?</label>
            </div>
          </div>
      </div>
      <div class="col-xs-12 col-md-6">
        <div class="input-group mt-2 mb-2">
              <div class="input-group-prepend">
                <span class="input-group-text"> Refresh Interval </span>
              </div>
              <input type="text" class="form-control" v-model="refresh" />
            </div>
            <div class="input-group mt-2 mb-2">
              <div class="input-group-prepend">
                <span class="input-group-text"> Page Size </span>
              </div>
              <input type="number" class="form-control" v-model="limit" />
            </div>
            <div class="input-group mt-2 mb-2">
            <div class="input-group-prepend">
                <span class="input-group-text"> State </span>
              </div>
                <select v-model="state" class="form-control" id="selectStateInput">
                  <option v-bind:class="option.class" v-for="option in stateobject" v-bind:value="option.value">{{option.text}}</option>
                </select>
          </div>
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-xs-12 col-md-3 ml-auto text-right">
        <button type=submit @click="$emit('search-form', name, search, property, limit, skip, refresh, state, object)" class="d-none d-md-inline-block btn btn-success"> Apply </button>
        <button type=submit @click="$emit('search-form', name, search, property, limit, skip, refresh, state, object)" class="d-none d-inline-block d-md-none btn btn-block btn-success"> Apply </button>
      </div>
    </div>
  </form>
  `,
});
